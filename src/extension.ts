import * as fs from "node:fs/promises";
import * as path from "node:path";

import * as vscode from "vscode";

import { affectsWalkthroughPresentation, isWalkthroughFilePath } from "./config";
import { ExplanationPanelManager } from "./explanationPanel";
import { WalkthroughPlayer, type PlayerObserver } from "./player";
import { SidebarViewProvider } from "./sidebarView";
import { type PlaybackState, type WalkthroughErrorState, type WalkthroughSummary } from "./types";
import { discoverWalkthroughs, loadWalkthrough } from "./walkthroughs";

class ExtensionController implements PlayerObserver, vscode.Disposable {
  private readonly player: WalkthroughPlayer;
  private readonly sidebar: SidebarViewProvider;
  private readonly explanationPanel: ExplanationPanelManager;
  private walkthroughs: WalkthroughSummary[] = [];
  private currentError: WalkthroughErrorState | null = null;

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly workspaceRoot: string,
  ) {
    this.player = new WalkthroughPlayer(workspaceRoot, this);
    this.explanationPanel = new ExplanationPanelManager(context, async () => {
      await this.player.setExplanationPanelVisible(false);
    });
    this.sidebar = new SidebarViewProvider(context, {
      startWalkthrough: async (relativePath) => this.start(relativePath),
      editWalkthrough: async (relativePath) => this.edit(relativePath),
      deleteWalkthrough: async (relativePath) => this.remove(relativePath),
      openSettings: async () => this.openSettings(),
      next: async () => this.runPlaybackAction(() => this.player.next()),
      previous: async () => this.runPlaybackAction(() => this.player.previous()),
      jumpToStep: async (index) => this.runPlaybackAction(() => this.player.jumpToStep(index)),
      toggleExplanationPanel: async () => this.runPlaybackAction(() => this.player.toggleExplanationPanel()),
      exit: async () => this.exit(),
    });

    context.subscriptions.push(
      this.player,
      this.explanationPanel,
      vscode.window.registerWebviewViewProvider(SidebarViewProvider.viewType, this.sidebar, {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }),
      vscode.commands.registerCommand("walkthrough.start", async (relativePath?: string) => {
        if (typeof relativePath === "string") {
          await this.start(relativePath);
          return;
        }

        await this.refreshLibrary();
        if (this.walkthroughs.length > 0) {
          await this.start(this.walkthroughs[0].relativePath);
        }
      }),
      vscode.commands.registerCommand("walkthrough.next", async () => this.runPlaybackAction(() => this.player.next())),
      vscode.commands.registerCommand("walkthrough.previous", async () => this.runPlaybackAction(() => this.player.previous())),
      vscode.commands.registerCommand("walkthrough.exit", async () => this.exit()),
      vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        await this.player.restoreDecorationsForVisibleEditor(editor);
      }),
      vscode.workspace.onDidCreateFiles(async () => this.refreshLibrary()),
      vscode.workspace.onDidDeleteFiles(async () => this.refreshLibrary()),
      vscode.workspace.onDidRenameFiles(async () => this.refreshLibrary()),
      vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (isWalkthroughFilePath(document.uri.fsPath, workspaceRoot)) {
          await this.refreshLibrary();
        }
      }),
      vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (affectsWalkthroughPresentation(event)) {
          await this.player.refreshPresentation();
          await this.refreshLibrary();
        }
      }),
    );
  }

  public async initialize(): Promise<void> {
    await this.refreshLibrary();
  }

  public dispose(): void {
    this.explanationPanel.dispose();
    this.player.dispose();
  }

  public onPlaybackStateChanged(state: PlaybackState | null): void {
    if (state) {
      this.currentError = null;
    }

    this.render(state);
  }

  private async refreshLibrary(): Promise<void> {
    this.walkthroughs = await discoverWalkthroughs(this.workspaceRoot);
    this.render();
  }

  private async start(relativePath: string): Promise<void> {
    const result = await loadWalkthrough(this.workspaceRoot, relativePath);
    if (!result.ok) {
      this.currentError = result.error;
      this.player.stop();
      this.render(null);
      return;
    }

    this.currentError = null;
    await this.player.start(result.walkthrough);
  }

  private async edit(relativePath: string): Promise<void> {
    const fileUri = this.resolveWalkthroughUri(relativePath);
    if (!fileUri) {
      return;
    }

    const document = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: false,
    });
  }

  private async remove(relativePath: string): Promise<void> {
    const fileUri = this.resolveWalkthroughUri(relativePath);
    if (!fileUri) {
      return;
    }

    const confirmed = await vscode.window.showWarningMessage(
      `Are you sure? This will permanently delete the underlying walkthrough YAML file "${path.basename(relativePath)}".`,
      {
        modal: true,
        detail: "This action cannot be undone.",
      },
      "Delete",
    );
    if (confirmed !== "Delete") {
      return;
    }

    try {
      await fs.unlink(fileUri.fsPath);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== "ENOENT") {
        throw error;
      }
    }

    const playback = this.player.getState();
    if (playback?.walkthrough.relativePath === relativePath) {
      this.currentError = null;
      this.player.stop();
    }

    await this.refreshLibrary();
  }

  private async openSettings(): Promise<void> {
    await vscode.commands.executeCommand("workbench.action.openSettings", "walkthrough.libraryLocation");
  }

  private async exit(): Promise<void> {
    this.currentError = null;
    this.player.stop();
    await this.refreshLibrary();
  }

  private async runPlaybackAction(action: () => Promise<void>): Promise<void> {
    this.currentError = null;
    await action();

    if (!this.player.getState()) {
      this.render(null);
    }
  }

  private render(playback: PlaybackState | null = this.player.getState()): void {
    if (playback) {
      if (playback.explanationPanelVisible) {
        this.explanationPanel.show(playback);
      } else {
        this.explanationPanel.hide();
      }

      this.sidebar.showPlayback(this.walkthroughs, playback);
      return;
    }

    this.explanationPanel.hide();

    if (this.currentError) {
      this.sidebar.showError(this.walkthroughs, this.currentError);
      return;
    }

    this.sidebar.showBrowse(this.walkthroughs);
  }

  private resolveWalkthroughUri(relativePath: string): vscode.Uri | null {
    const absolutePath = path.resolve(this.workspaceRoot, relativePath);
    return isWalkthroughFilePath(absolutePath, this.workspaceRoot) ? vscode.Uri.file(absolutePath) : null;
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  const controller = new ExtensionController(context, workspaceFolder.uri.fsPath);
  context.subscriptions.push(controller);
  await controller.initialize();
}

export function deactivate(): void {
  // VS Code disposes subscriptions automatically; no extra work is needed.
}

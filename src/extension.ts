import * as path from "node:path";
import * as fs from "node:fs/promises";

import * as vscode from "vscode";

import { isWalkthroughFilePath } from "./config";
import { DecorationsManager } from "./decorations";
import { ExplanationPanelManager } from "./explanationPanel";
import { WalkthroughPlayer, type PlayerObserver } from "./player";
import { SidebarViewProvider } from "./sidebarView";
import { type PlaybackState, type WalkthroughErrorState, type WalkthroughSummary } from "./types";
import { WalkthroughLoader } from "./walkthroughLoader";

class ExtensionController implements PlayerObserver, vscode.Disposable {
  private readonly loader: WalkthroughLoader;
  private readonly player: WalkthroughPlayer;
  private readonly sidebar: SidebarViewProvider;
  private readonly explanationPanel: ExplanationPanelManager;
  private walkthroughs: WalkthroughSummary[] = [];
  private currentError: WalkthroughErrorState | null = null;

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly workspaceRoot: string,
  ) {
    const decorations = new DecorationsManager();
    this.loader = new WalkthroughLoader(workspaceRoot);
    this.player = new WalkthroughPlayer(workspaceRoot, decorations, this);
    this.explanationPanel = new ExplanationPanelManager(context, async () => {
      await this.player.setExplanationPanelVisible(false);
    });
    this.sidebar = new SidebarViewProvider(context, {
      startWalkthrough: async (relativePath) => this.startWalkthrough(relativePath),
      editWalkthrough: async (relativePath) => this.editWalkthrough(relativePath),
      deleteWalkthrough: async (relativePath) => this.deleteWalkthrough(relativePath),
      openSettings: async () => this.openSettings(),
      next: async () => this.next(),
      previous: async () => this.previous(),
      jumpToStep: async (index) => this.jumpToStep(index),
      toggleExplanationPanel: async () => this.toggleExplanationPanel(),
      exit: async () => this.exit(),
    });

    context.subscriptions.push(
      decorations,
      this.player,
      this.explanationPanel,
      vscode.window.registerWebviewViewProvider(SidebarViewProvider.viewType, this.sidebar, {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }),
      vscode.commands.registerCommand("walkthrough.start", async (relativePath?: string) => {
        if (typeof relativePath === "string") {
          await this.startWalkthrough(relativePath);
          return;
        }

        await this.refreshBrowseState();
        if (this.walkthroughs.length > 0) {
          await this.startWalkthrough(this.walkthroughs[0].relativePath);
        }
      }),
      vscode.commands.registerCommand("walkthrough.next", async () => this.next()),
      vscode.commands.registerCommand("walkthrough.previous", async () => this.previous()),
      vscode.commands.registerCommand("walkthrough.exit", async () => this.exit()),
      vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        await this.player.restoreDecorationsForVisibleEditor(editor);
      }),
      vscode.workspace.onDidCreateFiles(async () => this.refreshBrowseState()),
      vscode.workspace.onDidDeleteFiles(async () => this.refreshBrowseState()),
      vscode.workspace.onDidRenameFiles(async () => this.refreshBrowseState()),
      vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (isWalkthroughFilePath(document.uri.fsPath, workspaceRoot)) {
          await this.refreshBrowseState();
        }
      }),
      vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (
          event.affectsConfiguration("walkthrough.libraryLocation")
          || event.affectsConfiguration("walkthrough.dimmingStrength")
          || event.affectsConfiguration("walkthrough.highlightColor")
          || event.affectsConfiguration("walkthrough.explanationFontSizePx")
        ) {
          await this.player.refreshPresentation();
          await this.refreshBrowseState();
        }
      }),
    );
  }

  public async initialize(): Promise<void> {
    await this.refreshBrowseState();
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

  private async refreshBrowseState(): Promise<void> {
    this.walkthroughs = await this.loader.discoverWalkthroughs();
    this.render();
  }

  private async startWalkthrough(relativePath: string): Promise<void> {
    const result = await this.loader.loadWalkthrough(relativePath);
    if (!result.ok) {
      this.currentError = result.error;
      this.player.stop();
      return;
    }

    this.clearError();
    await this.player.start(result.walkthrough);
  }

  private async editWalkthrough(relativePath: string): Promise<void> {
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

  private async deleteWalkthrough(relativePath: string): Promise<void> {
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
      if (nodeError.code === "ENOENT") {
        await this.refreshBrowseState();
        return;
      }

      throw error;
    }

    const playback = this.player.getState();
    if (playback?.walkthrough.relativePath === relativePath) {
      this.clearError();
      this.player.stop();
    }

    await this.refreshBrowseState();
  }

  private async openSettings(): Promise<void> {
    await vscode.commands.executeCommand("workbench.action.openSettings", `@ext:${this.context.extension.id}`);
  }

  private async next(): Promise<void> {
    this.clearError();
    await this.player.next();
  }

  private async previous(): Promise<void> {
    this.clearError();
    await this.player.previous();
  }

  private async jumpToStep(index: number): Promise<void> {
    this.clearError();
    await this.player.jumpToStep(index);
  }

  private async toggleExplanationPanel(): Promise<void> {
    this.clearError();
    await this.player.toggleExplanationPanel();
  }

  private async exit(): Promise<void> {
    this.clearError();
    this.player.stop();
    await this.refreshBrowseState();
  }

  private clearError(): void {
    this.currentError = null;
  }

  private render(playback: PlaybackState | null = this.player.getState()): void {
    if (playback) {
      this.syncExplanationPanel(playback);
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

  private syncExplanationPanel(state: PlaybackState): void {
    if (state.explanationPanelVisible) {
      this.explanationPanel.show(state);
    } else {
      this.explanationPanel.hide();
    }
  }

  private resolveWalkthroughUri(relativePath: string): vscode.Uri | null {
    const absolutePath = path.resolve(this.workspaceRoot, relativePath);
    if (!isWalkthroughFilePath(absolutePath, this.workspaceRoot)) {
      return null;
    }

    return vscode.Uri.file(absolutePath);
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

import * as path from "node:path";

import * as vscode from "vscode";

import { DecorationsManager } from "./decorations";
import { WalkthroughPlayer, type PlayerObserver } from "./player";
import { SidebarViewProvider } from "./sidebarView";
import { type PlaybackState, type WalkthroughErrorState, type WalkthroughSummary } from "./types";
import { WalkthroughLoader } from "./walkthroughLoader";

class ExtensionController implements PlayerObserver, vscode.Disposable {
  private readonly loader: WalkthroughLoader;
  private readonly player: WalkthroughPlayer;
  private readonly sidebar: SidebarViewProvider;
  private walkthroughs: WalkthroughSummary[] = [];
  private currentError: WalkthroughErrorState | null = null;

  public constructor(private readonly context: vscode.ExtensionContext, workspaceRoot: string) {
    const decorations = new DecorationsManager();
    this.loader = new WalkthroughLoader(workspaceRoot);
    this.player = new WalkthroughPlayer(workspaceRoot, decorations, this);
    this.sidebar = new SidebarViewProvider(context, {
      startWalkthrough: async (relativePath) => this.startWalkthrough(relativePath),
      next: async () => this.next(),
      previous: async () => this.previous(),
      jumpToStep: async (index) => this.jumpToStep(index),
      exit: async () => this.exit(),
    });

    context.subscriptions.push(
      decorations,
      this.player,
      vscode.window.registerWebviewViewProvider(SidebarViewProvider.viewType, this.sidebar),
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
        if (document.uri.fsPath.includes(`${path.sep}.walkthroughs${path.sep}`)) {
          await this.refreshBrowseState();
        }
      }),
    );
  }

  public async initialize(): Promise<void> {
    await this.refreshBrowseState();
  }

  public dispose(): void {
    this.player.dispose();
  }

  public onPlaybackStateChanged(state: PlaybackState | null): void {
    if (state) {
      this.currentError = null;
      this.sidebar.showPlayback(this.walkthroughs, state);
      return;
    }

    if (this.currentError) {
      this.sidebar.showError(this.walkthroughs, this.currentError);
      return;
    }

    this.sidebar.showBrowse(this.walkthroughs);
  }

  private async refreshBrowseState(): Promise<void> {
    this.walkthroughs = await this.loader.discoverWalkthroughs();
    const playback = this.player.getState();

    if (playback) {
      this.sidebar.showPlayback(this.walkthroughs, playback);
      return;
    }

    if (this.currentError) {
      this.sidebar.showError(this.walkthroughs, this.currentError);
      return;
    }

    this.sidebar.showBrowse(this.walkthroughs);
  }

  private async startWalkthrough(relativePath: string): Promise<void> {
    const result = await this.loader.loadWalkthrough(relativePath);
    if (!result.ok) {
      this.player.stop();
      this.currentError = result.error;
      this.sidebar.showError(this.walkthroughs, result.error);
      return;
    }

    this.currentError = null;
    await this.player.start(result.walkthrough);
  }

  private async next(): Promise<void> {
    this.currentError = null;
    await this.player.next();
  }

  private async previous(): Promise<void> {
    this.currentError = null;
    await this.player.previous();
  }

  private async jumpToStep(index: number): Promise<void> {
    this.currentError = null;
    await this.player.jumpToStep(index);
  }

  private async exit(): Promise<void> {
    this.currentError = null;
    this.player.stop();
    await this.refreshBrowseState();
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

import * as fs from "node:fs/promises";
import * as path from "node:path";

import * as vscode from "vscode";

import { getWalkLibraryLocation } from "./config";
import {
  type PlaybackState,
  type WalkthroughErrorState,
  type WalkthroughSummary,
} from "./types";

export interface SidebarController {
  startWalkthrough(relativePath: string): Promise<void>;
  editWalkthrough(relativePath: string): Promise<void>;
  deleteWalkthrough(relativePath: string): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  jumpToStep(index: number): Promise<void>;
  toggleExplanationPanel(): Promise<void>;
  exit(): Promise<void>;
}

type SidebarMode = "browse" | "playback" | "error";

interface SidebarRenderState {
  mode: SidebarMode;
  walkthroughs: WalkthroughSummary[];
  playback: PlaybackState | null;
  error: WalkthroughErrorState | null;
  libraryLocation: string;
}

export class SidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "walkthrough.sidebar";

  private webviewView: vscode.WebviewView | undefined;
  private renderState: SidebarRenderState = {
    mode: "browse",
    walkthroughs: [],
    playback: null,
    error: null,
    libraryLocation: getWalkLibraryLocation(),
  };

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly controller: SidebarController,
  ) {}

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _resolveContext: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "media")],
    };

    webviewView.webview.html = await this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message: unknown) => {
      void this.handleMessage(message);
    });

    this.postState();
  }

  public showBrowse(walkthroughs: WalkthroughSummary[]): void {
    this.renderState = {
      mode: "browse",
      walkthroughs,
      playback: null,
      error: null,
      libraryLocation: getWalkLibraryLocation(),
    };
    this.postState();
  }

  public showPlayback(walkthroughs: WalkthroughSummary[], playback: PlaybackState): void {
    this.renderState = {
      mode: "playback",
      walkthroughs,
      playback,
      error: null,
      libraryLocation: getWalkLibraryLocation(),
    };
    this.postState();
  }

  public showError(walkthroughs: WalkthroughSummary[], error: WalkthroughErrorState): void {
    this.renderState = {
      mode: "error",
      walkthroughs,
      playback: null,
      error,
      libraryLocation: getWalkLibraryLocation(),
    };
    this.postState();
  }

  private async getHtml(webview: vscode.Webview): Promise<string> {
    const mediaUri = vscode.Uri.joinPath(this.context.extensionUri, "media");
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "sidebar.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "sidebar.css"));
    const templatePath = path.join(this.context.extensionPath, "media", "sidebar.html");
    const template = await fs.readFile(templatePath, "utf8");
    const nonce = createNonce();

    return template
      .replaceAll("{{cspSource}}", webview.cspSource)
      .replaceAll("{{styleUri}}", styleUri.toString())
      .replaceAll("{{scriptUri}}", scriptUri.toString())
      .replaceAll("{{nonce}}", nonce);
  }

  private postState(): void {
    this.webviewView?.webview.postMessage({
      type: "renderState",
      payload: this.renderState,
    });
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isRecord(message) || typeof message.type !== "string") {
      return;
    }

    switch (message.type) {
      case "startWalkthrough":
        if (typeof message.relativePath === "string") {
          await this.controller.startWalkthrough(message.relativePath);
        }
        return;
      case "editWalkthrough":
        if (typeof message.relativePath === "string") {
          await this.controller.editWalkthrough(message.relativePath);
        }
        return;
      case "deleteWalkthrough":
        if (typeof message.relativePath === "string") {
          await this.controller.deleteWalkthrough(message.relativePath);
        }
        return;
      case "next":
        await this.controller.next();
        return;
      case "previous":
        await this.controller.previous();
        return;
      case "jumpToStep":
        if (typeof message.index === "number") {
          await this.controller.jumpToStep(message.index);
        }
        return;
      case "toggleExplanationPanel":
        await this.controller.toggleExplanationPanel();
        return;
      case "exit":
        await this.controller.exit();
        return;
      default:
        return;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createNonce(): string {
  return Math.random().toString(36).slice(2, 12);
}

import * as fs from "node:fs/promises";
import * as path from "node:path";

import * as vscode from "vscode";

import { getWalkLibraryLocation } from "./config";
import {
  type PlaybackState,
  type WalkthroughErrorState,
  type WalkthroughSummary,
} from "./types";
import { getSharedUiTokenCss } from "./uiTokens";

export interface SidebarController {
  startWalkthrough(relativePath: string): Promise<void>;
  editWalkthrough(relativePath: string): Promise<void>;
  deleteWalkthrough(relativePath: string): Promise<void>;
  openSettings(): Promise<void>;
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
  iconUris: SidebarIconUris;
}

interface SidebarIconUris {
  settings: string;
  edit: string;
  trash: string;
}

type SidebarMessage =
  | { type: "ready" }
  | { type: "startWalkthrough"; relativePath: string }
  | { type: "editWalkthrough"; relativePath: string }
  | { type: "deleteWalkthrough"; relativePath: string }
  | { type: "openSettings" }
  | { type: "next" }
  | { type: "previous" }
  | { type: "jumpToStep"; index: number }
  | { type: "toggleExplanationPanel" }
  | { type: "exit" };

export class SidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "walkthrough.sidebar";

  private webviewView: vscode.WebviewView | undefined;
  private iconUris: SidebarIconUris | null = null;
  private renderState: SidebarRenderState = {
    mode: "browse",
    walkthroughs: [],
    playback: null,
    error: null,
    libraryLocation: getWalkLibraryLocation(),
    iconUris: {
      settings: "",
      edit: "",
      trash: "",
    },
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
    this.iconUris = {
      settings: webviewView.webview
        .asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "icons", "settings.svg"))
        .toString(),
      edit: webviewView.webview
        .asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "icons", "edit.svg"))
        .toString(),
      trash: webviewView.webview
        .asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "icons", "trash.svg"))
        .toString(),
    };
    this.renderState = {
      ...this.renderState,
      iconUris: this.iconUris,
    };

    webviewView.webview.onDidReceiveMessage((message: unknown) => {
      void this.handleMessage(message);
    });
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.postState();
      }
    });

    webviewView.webview.html = await this.getHtml(webviewView.webview);
    this.postState();
  }

  public showBrowse(walkthroughs: WalkthroughSummary[]): void {
    this.show("browse", walkthroughs);
  }

  public showPlayback(walkthroughs: WalkthroughSummary[], playback: PlaybackState): void {
    this.show("playback", walkthroughs, playback);
  }

  public showError(walkthroughs: WalkthroughSummary[], error: WalkthroughErrorState): void {
    this.show("error", walkthroughs, null, error);
  }

  private async getHtml(webview: vscode.Webview): Promise<string> {
    const mediaUri = vscode.Uri.joinPath(this.context.extensionUri, "media");
    const markdownScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "markdown.js"));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "sidebar.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "sidebar.css"));
    const templatePath = path.join(this.context.extensionPath, "media", "sidebar.html");
    const template = await fs.readFile(templatePath, "utf8");
    const nonce = createNonce();
    const sharedTokenCss = getSharedUiTokenCss();

    return template
      .replaceAll("{{cspSource}}", webview.cspSource)
      .replaceAll("{{markdownScriptUri}}", markdownScriptUri.toString())
      .replaceAll("{{styleUri}}", styleUri.toString())
      .replaceAll("{{scriptUri}}", scriptUri.toString())
      .replaceAll("{{sharedTokenCss}}", sharedTokenCss)
      .replaceAll("{{nonce}}", nonce);
  }

  private postState(): void {
    this.webviewView?.webview.postMessage({
      type: "renderState",
      payload: this.renderState,
    });
  }

  private show(
    mode: SidebarMode,
    walkthroughs: WalkthroughSummary[],
    playback: PlaybackState | null = null,
    error: WalkthroughErrorState | null = null,
  ): void {
    this.renderState = {
      mode,
      walkthroughs,
      playback,
      error,
      libraryLocation: getWalkLibraryLocation(),
      iconUris:
        this.iconUris ??
        this.renderState.iconUris,
    };
    this.postState();
  }

  private async handleMessage(message: unknown): Promise<void> {
    const sidebarMessage = parseSidebarMessage(message);
    if (!sidebarMessage) {
      return;
    }

    switch (sidebarMessage.type) {
      case "ready":
        this.postState();
        return;
      case "startWalkthrough":
        await this.controller.startWalkthrough(sidebarMessage.relativePath);
        return;
      case "editWalkthrough":
        await this.controller.editWalkthrough(sidebarMessage.relativePath);
        return;
      case "deleteWalkthrough":
        await this.controller.deleteWalkthrough(sidebarMessage.relativePath);
        return;
      case "openSettings":
        await this.controller.openSettings();
        return;
      case "next":
        await this.controller.next();
        return;
      case "previous":
        await this.controller.previous();
        return;
      case "jumpToStep":
        await this.controller.jumpToStep(sidebarMessage.index);
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

function parseSidebarMessage(message: unknown): SidebarMessage | null {
  if (!isRecord(message) || typeof message.type !== "string") {
    return null;
  }

  switch (message.type) {
    case "ready":
      return message as SidebarMessage;
    case "startWalkthrough":
    case "editWalkthrough":
    case "deleteWalkthrough":
      return typeof message.relativePath === "string" ? message as SidebarMessage : null;
    case "jumpToStep":
      return typeof message.index === "number" ? message as SidebarMessage : null;
    case "openSettings":
    case "next":
    case "previous":
    case "toggleExplanationPanel":
    case "exit":
      return message as SidebarMessage;
    default:
      return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createNonce(): string {
  return Math.random().toString(36).slice(2, 12);
}

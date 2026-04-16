import * as vscode from "vscode";

import { getUiTypographyPreset, getWalkLibraryLocation } from "./config";
import { renderSidebarMarkup } from "./sidebarMarkup";
import {
  type PlaybackState,
  type WalkthroughErrorState,
  type WalkthroughSummary,
} from "./types";
import { getSharedUiTokenCss } from "./uiTokens";
import { createWebviewDocument, getWebviewUri } from "./webview";

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

export type SidebarMode = "browse" | "playback" | "error";

export interface SidebarRenderState {
  mode: SidebarMode;
  walkthroughs: WalkthroughSummary[];
  playback: PlaybackState | null;
  error: WalkthroughErrorState | null;
  libraryLocation: string;
}

export interface SidebarIconUris {
  settings: string;
  edit: string;
  trash: string;
}

interface SidebarClientState {
  mode: SidebarMode;
  playback: {
    currentStepIndex: number;
    stepCount: number;
  } | null;
}

export type SidebarMessage =
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
  private iconUris: SidebarIconUris = {
    settings: "",
    edit: "",
    trash: "",
  };
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
    const styleUri = getWebviewUri(webview, this.context.extensionUri, "media", "sidebar.css");
    const scriptUri = getWebviewUri(webview, this.context.extensionUri, "media", "sidebar.js");
    const monaspaceNeonFontUri = getWebviewUri(
      webview,
      this.context.extensionUri,
      "media",
      "fonts",
      "Monaspace Neon Var.woff2",
    );
    const sharedTokenCss = getSharedUiTokenCss({
      monaspaceNeonFontUri,
      typographyPreset: getUiTypographyPreset(),
    });

    return createWebviewDocument(webview, {
      title: "Code Walkthrough",
      body: '    <div id="app"></div>',
      sharedCss: sharedTokenCss,
      styleUris: [styleUri],
      scriptUris: [scriptUri],
      allowImages: true,
    });
  }

  private postState(): void {
    this.webviewView?.webview.postMessage({
      type: "renderState",
      state: toSidebarClientState(this.renderState),
      markup: renderSidebarMarkup(this.renderState, this.iconUris),
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

export function parseSidebarMessage(message: unknown): SidebarMessage | null {
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

function toSidebarClientState(state: SidebarRenderState): SidebarClientState {
  return {
    mode: state.mode,
    playback: state.playback
      ? {
          currentStepIndex: state.playback.currentStepIndex,
          stepCount: state.playback.walkthrough.steps.length,
        }
      : null,
  };
}

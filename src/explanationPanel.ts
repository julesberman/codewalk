import * as vscode from "vscode";

import { getExplanationFontSizePx, getUiTypographyPreset } from "./config";
import { renderMarkdownHtml } from "./markdown";
import { type PlaybackState } from "./types";
import { getSharedUiTokenCss } from "./uiTokens";
import { createWebviewDocument, escapeHtml, getWebviewUri } from "./webview";

export class ExplanationPanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private suppressCloseCallback = false;

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onDidClose: () => void | Promise<void>,
  ) {}

  public show(playback: PlaybackState): void {
    const panel = this.getOrCreatePanel();
    const step = playback.walkthrough.steps[playback.currentStepIndex];

    panel.title = `Explanation: ${step.title}`;
    panel.webview.html = renderExplanationDocument(panel.webview, this.context.extensionUri, playback);
    panel.reveal(vscode.ViewColumn.Beside, true);
  }

  public hide(): void {
    if (!this.panel) {
      return;
    }

    this.suppressCloseCallback = true;
    const panel = this.panel;
    this.panel = undefined;
    panel.dispose();
  }

  public dispose(): void {
    this.hide();
  }

  private getOrCreatePanel(): vscode.WebviewPanel {
    if (this.panel) {
      return this.panel;
    }

    const panel = vscode.window.createWebviewPanel(
      "walkthrough.explanation",
      "Explanation",
      {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
      },
      {
        enableScripts: false,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "media")],
      },
    );

    panel.onDidDispose(() => {
      this.panel = undefined;
      const suppressed = this.suppressCloseCallback;
      this.suppressCloseCallback = false;
      if (!suppressed) {
        void this.onDidClose();
      }
    });

    this.panel = panel;
    return panel;
  }
}

export function renderExplanationDocument(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  playback: PlaybackState,
): string {
  const step = playback.walkthrough.steps[playback.currentStepIndex];
  const styleUri = getWebviewUri(webview, extensionUri, "media", "explanation.css");
  const fontUri = getWebviewUri(webview, extensionUri, "media", "fonts", "Monaspace Neon Var.woff2");
  const sharedTokenCss = getSharedUiTokenCss({
    panelExplanationSizePx: getExplanationFontSizePx(),
    monaspaceNeonFontUri: fontUri,
    typographyPreset: getUiTypographyPreset(),
  });

  return createWebviewDocument(webview, {
    title: "Explanation",
    sharedCss: sharedTokenCss,
    styleUris: [styleUri],
    allowImages: true,
    body: `    <main class="page">
      <header class="header">
        <div class="eyebrow">${escapeHtml(playback.walkthrough.title)}</div>
        <h1 class="title">${escapeHtml(step.title)}</h1>
        <div class="meta">${escapeHtml(step.file)} · Lines ${step.range.start}-${step.range.end}</div>
      </header>
      <section class="content markdown">${renderMarkdownHtml(step.explanation)}</section>
    </main>`,
  });
}

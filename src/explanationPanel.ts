import * as vscode from "vscode";

import { getExplanationFontSizePx } from "./config";
import { type PlaybackState } from "./types";

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
    panel.webview.html = this.getHtml(panel.webview, playback);
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
        enableScripts: true,
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

  private getHtml(webview: vscode.Webview, playback: PlaybackState): string {
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "explanation.css"));
    const markdownScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "markdown.js"));
    const step = playback.walkthrough.steps[playback.currentStepIndex];
    const nonce = createNonce();
    const serializedExplanation = serializeForScript(step.explanation);

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link nonce="${nonce}" rel="stylesheet" href="${styleUri.toString()}" />
    <style nonce="${nonce}">:root { --panel-explanation-font-size: ${getExplanationFontSizePx()}px; }</style>
    <title>Explanation</title>
  </head>
  <body>
    <main class="page">
      <header class="header">
        <div class="eyebrow">${escapeHtml(playback.walkthrough.title)}</div>
        <h1 class="title">${escapeHtml(step.title)}</h1>
        <div class="meta">${escapeHtml(step.file)} · Lines ${step.range.start}-${step.range.end}</div>
      </header>
      <section id="content" class="content markdown"></section>
    </main>
    <script nonce="${nonce}" src="${markdownScriptUri.toString()}"></script>
    <script nonce="${nonce}">
      const content = document.getElementById("content");
      window.WalkthroughMarkdown?.renderInto(content, ${serializedExplanation});
    </script>
  </body>
</html>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createNonce(): string {
  return Math.random().toString(36).slice(2, 12);
}

function serializeForScript(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

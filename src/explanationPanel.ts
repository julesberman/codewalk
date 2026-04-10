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
    const step = playback.walkthrough.steps[playback.currentStepIndex];
    const nonce = createNonce();

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
      <section class="content markdown">
        ${renderMarkdown(step.explanation)}
      </section>
    </main>
  </body>
</html>`;
  }
}

function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let codeFence: string[] | null = null;

  const flushParagraph = (): void => {
    if (paragraph.length === 0) {
      return;
    }

    blocks.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = (): void => {
    if (listItems.length === 0) {
      return;
    }

    blocks.push(`<ul>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      if (codeFence) {
        blocks.push(`<pre><code>${escapeHtml(codeFence.join("\n"))}</code></pre>`);
        codeFence = null;
      } else {
        codeFence = [];
      }
      continue;
    }

    if (codeFence) {
      codeFence.push(line);
      continue;
    }

    const headingMatch = /^(#{1,4})\s+(.*)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = Math.min(headingMatch[1].length, 4);
      blocks.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    const listMatch = /^[-*]\s+(.*)$/.exec(line);
    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1]);
      continue;
    }

    if (line.trim().length === 0) {
      flushParagraph();
      flushList();
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  if (codeFence) {
    blocks.push(`<pre><code>${escapeHtml(codeFence.join("\n"))}</code></pre>`);
  }

  if (blocks.length === 0) {
    blocks.push(`<p>${escapeHtml(markdown)}</p>`);
  }

  return blocks.join("\n");
}

function renderInline(text: string): string {
  let output = escapeHtml(text);
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    const safeHref = sanitizeHref(href);
    return safeHref ? `<a href="${safeHref}">${label}</a>` : label;
  });
  return output;
}

function sanitizeHref(href: string): string | null {
  return /^(https?:|mailto:)/i.test(href) ? href : null;
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

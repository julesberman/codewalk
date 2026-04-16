import * as vscode from "vscode";

export interface WebviewDocumentOptions {
  title: string;
  body: string;
  nonce?: string;
  sharedCss?: string;
  styleUris?: string[];
  scriptUris?: string[];
  allowImages?: boolean;
}

export function createNonce(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function createWebviewDocument(
  webview: vscode.Webview,
  options: WebviewDocumentOptions,
): string {
  const nonce = options.nonce ?? createNonce();
  const styleTags = (options.styleUris ?? [])
    .map((href) => `    <link nonce="${nonce}" rel="stylesheet" href="${href}" />`)
    .join("\n");
  const scriptTags = (options.scriptUris ?? [])
    .map((src) => `    <script nonce="${nonce}" src="${src}"></script>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; ${options.allowImages ? `img-src ${webview.cspSource} https: data:; ` : ""}font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
${options.sharedCss ? `    <style nonce="${nonce}">${options.sharedCss}</style>\n` : ""}${styleTags ? `${styleTags}\n` : ""}    <title>${escapeHtml(options.title)}</title>
  </head>
  <body>
${options.body}
${scriptTags ? `${scriptTags}\n` : ""}  </body>
</html>`;
}

export function getWebviewUri(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  ...segments: string[]
): string {
  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...segments)).toString();
}

export function escapeHtml(text: string): string {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

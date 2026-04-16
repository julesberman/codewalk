import { type UiTypographyPreset } from "./config";

export interface SharedUiTokenOptions {
  panelExplanationSizePx?: number;
  monaspaceNeonFontUri?: string;
  typographyPreset?: UiTypographyPreset;
}

const baseFonts = {
  titleFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
  bodyFamily: "var(--vscode-font-family)",
  monoFamily: "var(--vscode-editor-font-family)",
};

export function getSharedUiTokenCss(options: SharedUiTokenOptions = {}): string {
  const fonts = getActiveFonts(options.typographyPreset ?? "monaspaceNeon");
  const panelExplanationSize = typeof options.panelExplanationSizePx === "number"
    ? `${options.panelExplanationSizePx}px`
    : "1.1rem";

  const lines = [
    ...getFontFaceCss(options.monaspaceNeonFontUri, options.typographyPreset ?? "monaspaceNeon"),
    "*, *::before, *::after {",
    "  box-sizing: border-box;",
    "}",
    ":root {",
    "  color-scheme: light dark;",
    `  --font-family-title: ${fonts.titleFamily};`,
    `  --font-family-body: ${fonts.bodyFamily};`,
    `  --font-family-mono: ${fonts.monoFamily};`,
    "  --font-size-body: 13px;",
    "  --font-size-meta: 11px;",
    "  --font-size-title: clamp(1.75rem, 1.55rem + 0.8vw, 2.25rem);",
    "  --font-size-section-title: 1.35rem;",
    "  --font-size-sidebar-explanation: 0.8rem;",
    `  --font-size-panel-explanation: ${panelExplanationSize};`,
    "  --color-text: var(--vscode-foreground);",
    "  --color-text-muted: color-mix(in srgb, var(--vscode-foreground) 62%, var(--vscode-sideBar-background));",
    "  --color-text-muted-panel: color-mix(in srgb, var(--vscode-foreground) 62%, var(--vscode-editor-background));",
    "  --color-rule: color-mix(in srgb, var(--vscode-foreground) 12%, transparent);",
    "  --color-surface: color-mix(in srgb, var(--vscode-editor-background) 72%, var(--vscode-sideBar-background));",
    "  --color-hover: color-mix(in srgb, var(--vscode-list-hoverBackground) 75%, transparent);",
    "  --color-active: color-mix(in srgb, var(--vscode-focusBorder) 60%, var(--vscode-foreground));",
    "  --color-error: var(--vscode-errorForeground);",
    "  --layout-page-padding-inline: 0px;",
    "  --layout-page-padding-block: 20px;",
    "  --layout-content-max-width: 100%;",
    "}",
    "a {",
    "  color: inherit;",
    "  text-decoration-color: color-mix(in srgb, var(--vscode-foreground) 30%, transparent);",
    "  text-underline-offset: 0.18em;",
    "}",
    "a:hover {",
    "  text-decoration-color: currentColor;",
    "}",
    ".markdown {",
    "  display: grid;",
    "  gap: var(--markdown-gap, 12px);",
    "  font-size: var(--markdown-font-size, inherit);",
    "  line-height: var(--markdown-line-height, inherit);",
    "}",
    ".markdown p,",
    ".markdown ul,",
    ".markdown ol,",
    ".markdown pre,",
    ".markdown blockquote,",
    ".markdown h1,",
    ".markdown h2,",
    ".markdown h3,",
    ".markdown h4 {",
    "  margin: 0;",
    "}",
    ".markdown h1,",
    ".markdown h2,",
    ".markdown h3,",
    ".markdown h4 {",
    "  font-family: var(--font-family-title);",
    "  font-weight: 500;",
    "  line-height: var(--markdown-heading-line-height, 1.2);",
    "}",
    ".markdown ul,",
    ".markdown ol {",
    "  padding-left: 1.2rem;",
    "}",
    ".markdown li + li {",
    "  margin-top: var(--markdown-list-item-gap, 0.25rem);",
    "}",
    ".markdown code {",
    "  font-family: var(--font-family-mono);",
    "  font-size: 0.93em;",
    "  padding: 0.08rem 0.22rem;",
    "  background: var(--color-surface);",
    "}",
    ".markdown pre {",
    "  overflow: auto;",
    "  padding: 12px 14px;",
    "  background: var(--color-surface);",
    "  border: 1px solid var(--color-rule);",
    "}",
    ".markdown pre code {",
    "  padding: 0;",
    "  background: transparent;",
    "}",
  ];

  return lines.join("\n");
}

function getActiveFonts(typographyPreset: UiTypographyPreset): Record<string, string> {
  if (typographyPreset === "system") {
    return baseFonts;
  }

  const fallbackStack = baseFonts;
  const monaspaceStack = '"Monaspace Neon Var", "Monaspace Neon", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

  return {
    titleFamily: `${monaspaceStack}, ${fallbackStack.titleFamily}`,
    bodyFamily: `${monaspaceStack}, ${fallbackStack.bodyFamily}`,
    monoFamily: `${monaspaceStack}, ${fallbackStack.monoFamily}`,
  };
}

function getFontFaceCss(fontUri: string | undefined, typographyPreset: UiTypographyPreset): string[] {
  if (!fontUri || typographyPreset === "system") {
    return [];
  }

  return [
    "@font-face {",
    '  font-family: "Monaspace Neon Var";',
    `  src: url("${fontUri}") format("woff2");`,
    "  font-style: normal;",
    "  font-weight: 100 800;",
    "  font-display: swap;",
    "}",
  ];
}

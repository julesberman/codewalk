interface SharedUiTokenSections {
  fonts: Record<string, string>;
  fontSizes: Record<string, string>;
  colors: Record<string, string>;
  layout: Record<string, string>;
}

export interface SharedUiTokenOptions {
  panelExplanationSizePx?: number;
}

export const sharedUiTokens = {
  fonts: {
    // Serif face for major titles and section headings.
    titleFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
    // Default font for body copy and controls.
    bodyFamily: "var(--vscode-font-family)",
    // Monospace font for labels, metadata, and code.
    monoFamily: "var(--vscode-editor-font-family)",
  },
  fontSizes: {
    // Base size for standard UI text.
    bodySize: "13px",
    // Small uppercase size for metadata and counters.
    metaSize: "11px",
    // Large responsive size for top-level titles.
    titleSize: "clamp(1.75rem, 1.55rem + 0.8vw, 2.25rem)",
    // Medium heading size for section titles.
    sectionTitleSize: "1.35rem",
    // Reading size for explanation text in the sidebar.
    sidebarExplanationSize: "0.8rem",
    // Reading size for explanation text in the panel.
    panelExplanationSize: "1.1rem",
  },
  colors: {
    // Primary text color across both webviews.
    textColor: "var(--vscode-foreground)",
    // Softer text for labels and supporting copy.
    mutedTextColor: "color-mix(in srgb, var(--vscode-foreground) 62%, var(--vscode-editor-background))",
    // Divider and border color for structural rules.
    ruleColor: "color-mix(in srgb, var(--vscode-foreground) 12%, transparent)",
    // Surface fill for inline code and panels.
    surfaceColor: "color-mix(in srgb, var(--vscode-editor-background) 72%, var(--vscode-sideBar-background))",
    // Hover background for clickable rows and buttons.
    hoverColor: "color-mix(in srgb, var(--vscode-list-hoverBackground) 75%, transparent)",
    // Accent color for active and highlighted states.
    activeColor: "color-mix(in srgb, var(--vscode-focusBorder) 60%, var(--vscode-foreground))",
    // Error text and destructive action color.
    errorColor: "var(--vscode-errorForeground)",
  },
  layout: {
    // Horizontal page padding for the sidebar shell.
    pagePaddingInline: "0px",
    // Vertical page padding for the sidebar shell.
    pagePaddingBlock: "20px",
    // Maximum width for the main sidebar column.
    contentMaxWidth: "100%",
  },
} satisfies SharedUiTokenSections;

export function getSharedUiTokenCss(options: SharedUiTokenOptions = {}): string {
  const fontSizes = {
    ...sharedUiTokens.fontSizes,
    panelExplanationSize:
      typeof options.panelExplanationSizePx === "number"
        ? `${options.panelExplanationSizePx}px`
        : sharedUiTokens.fontSizes.panelExplanationSize,
  };

  const lines = [
    ":root {",
    "  color-scheme: light dark;",
    ...toCssVariables({
      "font-family-title": sharedUiTokens.fonts.titleFamily,
      "font-family-body": sharedUiTokens.fonts.bodyFamily,
      "font-family-mono": sharedUiTokens.fonts.monoFamily,
      "font-size-body": fontSizes.bodySize,
      "font-size-meta": fontSizes.metaSize,
      "font-size-title": fontSizes.titleSize,
      "font-size-section-title": fontSizes.sectionTitleSize,
      "font-size-sidebar-explanation": fontSizes.sidebarExplanationSize,
      "font-size-panel-explanation": fontSizes.panelExplanationSize,
      "color-text": sharedUiTokens.colors.textColor,
      "color-text-muted": getSidebarMutedTextColor(),
      "color-text-muted-panel": sharedUiTokens.colors.mutedTextColor,
      "color-rule": sharedUiTokens.colors.ruleColor,
      "color-surface": sharedUiTokens.colors.surfaceColor,
      "color-hover": sharedUiTokens.colors.hoverColor,
      "color-active": sharedUiTokens.colors.activeColor,
      "color-error": sharedUiTokens.colors.errorColor,
      "layout-page-padding-inline": sharedUiTokens.layout.pagePaddingInline,
      "layout-page-padding-block": sharedUiTokens.layout.pagePaddingBlock,
      "layout-content-max-width": sharedUiTokens.layout.contentMaxWidth,
    }),
    "}",
  ];

  return lines.join("\n");
}

function toCssVariables(values: Record<string, string>): string[] {
  return Object.entries(values).map(([name, value]) => `  --${name}: ${value};`);
}

function getSidebarMutedTextColor(): string {
  return "color-mix(in srgb, var(--vscode-foreground) 62%, var(--vscode-sideBar-background))";
}

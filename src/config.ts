import * as path from "node:path";

import * as vscode from "vscode";

const CONFIG_SECTION = "walkthrough";
const DEFAULT_EDITOR_TOP_PADDING_LINES = 4;
const DEFAULT_DIMMING_STRENGTH = 0.62;
const DEFAULT_HIGHLIGHT_COLOR = "editor.wordHighlightBackground";
const DEFAULT_EXPLANATION_PANEL_OPEN = false;
const DEFAULT_EXPLANATION_FONT_SIZE_PX = 14;
const DEFAULT_LIBRARY_LOCATION = ".walkthroughs";
const DEFAULT_UI_TYPOGRAPHY_PRESET = "monaspaceNeon";

export type UiTypographyPreset = "monaspaceNeon" | "system";

export function getWalkthroughConfiguration(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(CONFIG_SECTION);
}

export function getEditorTopPaddingLines(): number {
  const configured = getWalkthroughConfiguration().get<number>("editorTopPaddingLines", DEFAULT_EDITOR_TOP_PADDING_LINES);
  if (typeof configured !== "number" || !Number.isFinite(configured)) {
    return DEFAULT_EDITOR_TOP_PADDING_LINES;
  }

  return Math.max(0, Math.floor(configured));
}

export function getDimmingStrength(): number {
  const configured = getWalkthroughConfiguration().get<number>("dimmingStrength", DEFAULT_DIMMING_STRENGTH);
  if (typeof configured !== "number" || !Number.isFinite(configured)) {
    return DEFAULT_DIMMING_STRENGTH;
  }

  return clamp(configured, 0, 1);
}

export function getHighlightColor(): vscode.ThemeColor | string {
  const configured = getWalkthroughConfiguration().get<string>("highlightColor", DEFAULT_HIGHLIGHT_COLOR)?.trim();
  if (!configured) {
    return new vscode.ThemeColor(DEFAULT_HIGHLIGHT_COLOR);
  }

  if (/^[A-Za-z][A-Za-z0-9.]+$/.test(configured)) {
    return new vscode.ThemeColor(configured);
  }

  return configured;
}

export function getExplanationPanelOpenByDefault(): boolean {
  return getWalkthroughConfiguration().get<boolean>("explanationPanelOpenByDefault", DEFAULT_EXPLANATION_PANEL_OPEN) === true;
}

export function getExplanationFontSizePx(): number {
  const configured = getWalkthroughConfiguration().get<number>("explanationFontSizePx", DEFAULT_EXPLANATION_FONT_SIZE_PX);
  if (typeof configured !== "number" || !Number.isFinite(configured)) {
    return DEFAULT_EXPLANATION_FONT_SIZE_PX;
  }

  return Math.max(10, Math.floor(configured));
}

export function getWalkLibraryLocation(): string {
  const configured = getWalkthroughConfiguration().get<string>("libraryLocation", DEFAULT_LIBRARY_LOCATION);
  const normalized = normalizeLibraryLocation(configured);
  return normalized ?? DEFAULT_LIBRARY_LOCATION;
}

export function getUiTypographyPreset(): UiTypographyPreset {
  const configured = getWalkthroughConfiguration().get<string>(
    "uiTypographyPreset",
    DEFAULT_UI_TYPOGRAPHY_PRESET,
  );

  return configured === "system" ? "system" : "monaspaceNeon";
}

export function toAbsoluteLibraryPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, getWalkLibraryLocation());
}

export function isWalkthroughFilePath(filePath: string, workspaceRoot: string): boolean {
  const absoluteLibraryPath = path.resolve(toAbsoluteLibraryPath(workspaceRoot));
  const absoluteFilePath = path.resolve(filePath);
  const relative = path.relative(absoluteLibraryPath, absoluteFilePath);
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeLibraryLocation(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed;
}

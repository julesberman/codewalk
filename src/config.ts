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
const PRESENTATION_CONFIG_KEYS = [
  "walkthrough.libraryLocation",
  "walkthrough.dimmingStrength",
  "walkthrough.highlightColor",
  "walkthrough.explanationFontSizePx",
  "walkthrough.uiTypographyPreset",
] as const;

export type UiTypographyPreset = "monaspaceNeon" | "system";

export function getEditorTopPaddingLines(): number {
  return coerceWholeNumber(readConfig("editorTopPaddingLines"), DEFAULT_EDITOR_TOP_PADDING_LINES, 0);
}

export function getDimmingStrength(): number {
  return coerceNumber(readConfig("dimmingStrength"), DEFAULT_DIMMING_STRENGTH, 0, 1);
}

export function getHighlightColor(): vscode.ThemeColor | string {
  return parseHighlightColor(readConfig("highlightColor"));
}

export function getExplanationPanelOpenByDefault(): boolean {
  return readConfig("explanationPanelOpenByDefault") === true;
}

export function getExplanationFontSizePx(): number {
  return coerceWholeNumber(readConfig("explanationFontSizePx"), DEFAULT_EXPLANATION_FONT_SIZE_PX, 10);
}

export function getWalkLibraryLocation(): string {
  return normalizeLibraryLocation(readConfig("libraryLocation")) ?? DEFAULT_LIBRARY_LOCATION;
}

export function getUiTypographyPreset(): UiTypographyPreset {
  return resolveTypographyPreset(readConfig("uiTypographyPreset"));
}

export function affectsWalkthroughPresentation(event: vscode.ConfigurationChangeEvent): boolean {
  return PRESENTATION_CONFIG_KEYS.some((key) => event.affectsConfiguration(key));
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

export function coerceNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, value));
}

export function coerceWholeNumber(value: unknown, fallback: number, minimum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.floor(value));
}

export function normalizeLibraryLocation(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed;
}

export function resolveTypographyPreset(value: unknown): UiTypographyPreset {
  return value === "system" ? "system" : "monaspaceNeon";
}

function readConfig(key: string): unknown {
  return vscode.workspace.getConfiguration(CONFIG_SECTION).get(key);
}

function parseHighlightColor(value: unknown): vscode.ThemeColor | string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return new vscode.ThemeColor(DEFAULT_HIGHLIGHT_COLOR);
  }

  const configured = value.trim();
  return /^[A-Za-z][A-Za-z0-9.]+$/.test(configured) ? new vscode.ThemeColor(configured) : configured;
}

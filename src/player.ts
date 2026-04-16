import * as path from "node:path";

import * as vscode from "vscode";

import {
  getDimmingStrength,
  getEditorTopPaddingLines,
  getExplanationPanelOpenByDefault,
  getHighlightColor,
} from "./config";
import { type PlaybackState, type Walkthrough, type WalkthroughStep } from "./types";

export interface PlayerObserver {
  onPlaybackStateChanged(state: PlaybackState | null): void;
}

export class WalkthroughPlayer implements vscode.Disposable {
  private playbackState: PlaybackState | null = null;
  private activeDecoration = this.createActiveDecoration();
  private inactiveDecoration = this.createInactiveDecoration();

  public constructor(
    private readonly workspaceRoot: string,
    private readonly observer: PlayerObserver,
  ) {}

  public getState(): PlaybackState | null {
    return this.playbackState;
  }

  public async start(walkthrough: Walkthrough): Promise<void> {
    this.reset(false);
    await this.revealIndex(createPlaybackState(walkthrough), 0);
  }

  public async next(): Promise<void> {
    const state = this.playbackState;
    if (!state) {
      return;
    }

    const nextIndex = getAdjacentPlaybackIndex(state, 1);
    if (nextIndex === null) {
      this.stop();
      return;
    }

    await this.revealIndex(state, nextIndex);
  }

  public async previous(): Promise<void> {
    const state = this.playbackState;
    if (!state) {
      return;
    }

    const previousIndex = getAdjacentPlaybackIndex(state, -1);
    if (previousIndex === null) {
      return;
    }

    await this.revealIndex(state, previousIndex);
  }

  public async jumpToStep(index: number): Promise<void> {
    const state = this.playbackState;
    if (!state || !isValidStepIndex(state.walkthrough, index)) {
      return;
    }

    await this.revealIndex(state, index);
  }

  public async toggleExplanationPanel(): Promise<void> {
    const state = this.playbackState;
    if (!state) {
      return;
    }

    await this.setExplanationPanelVisible(!state.explanationPanelVisible);
  }

  public async setExplanationPanelVisible(visible: boolean): Promise<void> {
    const state = this.playbackState;
    if (!state || state.explanationPanelVisible === visible) {
      return;
    }

    this.playbackState = withExplanationPanelVisibility(state, visible);
    this.notify();
  }

  public async restoreDecorationsForVisibleEditor(editor: vscode.TextEditor | undefined): Promise<void> {
    const state = this.playbackState;
    if (!editor || !state) {
      return;
    }

    const step = getCurrentStep(state);
    if (!matchesEditor(editor, this.workspaceRoot, step)) {
      this.clearDecorations();
      return;
    }

    this.applyDecorations(editor, step);
  }

  public stop(): void {
    this.reset(true);
  }

  public dispose(): void {
    this.reset(false);
    this.clearDecorations();
    this.activeDecoration.dispose();
    this.inactiveDecoration.dispose();
  }

  public async refreshPresentation(): Promise<void> {
    const state = this.playbackState;
    if (!state) {
      return;
    }

    this.clearDecorations();
    this.activeDecoration.dispose();
    this.inactiveDecoration.dispose();
    this.activeDecoration = this.createActiveDecoration();
    this.inactiveDecoration = this.createInactiveDecoration();

    const step = getCurrentStep(state);
    const editor = vscode.window.visibleTextEditors.find((candidate) =>
      matchesEditor(candidate, this.workspaceRoot, step),
    );

    if (editor) {
      this.applyDecorations(editor, step);
    }

    this.notify();
  }

  private async revealIndex(state: PlaybackState, index: number): Promise<void> {
    const nextState = withCurrentStepIndex(state, index);
    if (!nextState) {
      return;
    }

    this.playbackState = nextState;
    const step = getCurrentStep(nextState);
    const fileUri = vscode.Uri.file(path.join(this.workspaceRoot, step.file));
    const document = await vscode.workspace.openTextDocument(fileUri);
    const editor = await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: true,
    });

    const targetRange = new vscode.Range(
      new vscode.Position(step.range.start - 1, 0),
      new vscode.Position(step.range.end - 1, 0),
    );
    const revealLine = Math.max(0, step.range.start - 1 - getEditorTopPaddingLines());
    const revealRange = document.lineAt(revealLine).range;
    const caretPosition = document.lineAt(step.range.end - 1).range.end;

    editor.selection = new vscode.Selection(caretPosition, caretPosition);
    editor.revealRange(revealRange, vscode.TextEditorRevealType.AtTop);
    this.applyDecorations(editor, step);
    editor.revealRange(targetRange, vscode.TextEditorRevealType.Default);
    this.notify();
  }

  private reset(notify: boolean): void {
    this.playbackState = null;
    this.clearDecorations();
    if (notify) {
      this.observer.onPlaybackStateChanged(null);
    }
  }

  private notify(): void {
    if (this.playbackState) {
      this.observer.onPlaybackStateChanged(this.playbackState);
    }
  }

  private applyDecorations(editor: vscode.TextEditor, step: WalkthroughStep): void {
    this.clearDecorations();
    editor.setDecorations(this.activeDecoration, [toWholeLineRange(step)]);
    editor.setDecorations(this.inactiveDecoration, buildInactiveRanges(editor.document, step));
  }

  private clearDecorations(): void {
    for (const visibleEditor of vscode.window.visibleTextEditors) {
      visibleEditor.setDecorations(this.activeDecoration, []);
      visibleEditor.setDecorations(this.inactiveDecoration, []);
    }
  }

  private createActiveDecoration(): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: getHighlightColor(),
    });
  }

  private createInactiveDecoration(): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      opacity: String(getDimmingStrength()),
    });
  }
}

export function createPlaybackState(walkthrough: Walkthrough): PlaybackState {
  return {
    walkthrough,
    currentStepIndex: 0,
    explanationPanelVisible: getExplanationPanelOpenByDefault(),
  };
}

export function getAdjacentPlaybackIndex(state: PlaybackState, direction: 1 | -1): number | null {
  const nextIndex = state.currentStepIndex + direction;
  return isValidStepIndex(state.walkthrough, nextIndex) ? nextIndex : null;
}

export function withCurrentStepIndex(state: PlaybackState, index: number): PlaybackState | null {
  if (!isValidStepIndex(state.walkthrough, index)) {
    return null;
  }

  return {
    ...state,
    currentStepIndex: index,
  };
}

export function withExplanationPanelVisibility(state: PlaybackState, visible: boolean): PlaybackState {
  return {
    ...state,
    explanationPanelVisible: visible,
  };
}

function getCurrentStep(state: PlaybackState): WalkthroughStep {
  return state.walkthrough.steps[state.currentStepIndex];
}

function isValidStepIndex(walkthrough: Walkthrough, index: number): boolean {
  return index >= 0 && index < walkthrough.steps.length;
}

function matchesEditor(editor: vscode.TextEditor, workspaceRoot: string, step: WalkthroughStep): boolean {
  const expected = path.normalize(path.join(workspaceRoot, step.file));
  return path.normalize(editor.document.uri.fsPath) === expected;
}

function buildInactiveRanges(
  document: vscode.TextDocument,
  step: WalkthroughStep,
): vscode.DecorationOptions[] {
  const ranges: vscode.DecorationOptions[] = [];
  const startLine = step.range.start - 1;
  const endLine = step.range.end - 1;

  for (let line = 0; line < document.lineCount; line += 1) {
    if (line >= startLine && line <= endLine) {
      continue;
    }

    ranges.push({
      range: document.lineAt(line).range,
    });
  }

  return ranges;
}

function toWholeLineRange(step: WalkthroughStep): vscode.Range {
  return new vscode.Range(
    new vscode.Position(step.range.start - 1, 0),
    new vscode.Position(step.range.end - 1, Number.MAX_SAFE_INTEGER),
  );
}

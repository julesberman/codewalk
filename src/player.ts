import * as path from "node:path";

import * as vscode from "vscode";

import {
  getEditorTopPaddingLines,
  getExplanationPanelOpenByDefault,
} from "./config";
import { DecorationsManager } from "./decorations";
import {
  type WalkthroughStep,
  type PlaybackState,
  type ValidatedWalkthrough,
} from "./types";

export interface PlayerObserver {
  onPlaybackStateChanged(state: PlaybackState | null): void;
}

export class WalkthroughPlayer implements vscode.Disposable {
  private activeState: PlaybackState | null = null;

  public constructor(
    private readonly workspaceRoot: string,
    private readonly decorations: DecorationsManager,
    private readonly observer: PlayerObserver,
  ) { }

  public getState(): PlaybackState | null {
    return this.activeState;
  }

  public async start(walkthrough: ValidatedWalkthrough): Promise<void> {
    this.stop();
    this.activeState = {
      walkthrough,
      currentStepIndex: 0,
      explanationPanelVisible: getExplanationPanelOpenByDefault(),
    };
    await this.revealStepAtIndex(0);
  }

  public async next(): Promise<void> {
    const state = this.activeState;
    if (!state) {
      return;
    }

    const nextIndex = state.currentStepIndex + 1;
    if (nextIndex >= state.walkthrough.steps.length) {
      this.stop();
      return;
    }

    await this.revealStepAtIndex(nextIndex);
  }

  public async previous(): Promise<void> {
    const state = this.activeState;
    if (!state) {
      return;
    }

    const previousIndex = state.currentStepIndex - 1;
    if (previousIndex < 0) {
      return;
    }

    await this.revealStepAtIndex(previousIndex);
  }

  public async jumpToStep(index: number): Promise<void> {
    if (!this.canRevealIndex(index)) {
      return;
    }

    await this.revealStepAtIndex(index);
  }

  public async toggleExplanationPanel(): Promise<void> {
    if (!this.activeState) {
      return;
    }

    await this.setExplanationPanelVisible(!this.activeState.explanationPanelVisible);
  }

  public async setExplanationPanelVisible(visible: boolean): Promise<void> {
    if (!this.activeState || this.activeState.explanationPanelVisible === visible) {
      return;
    }

    this.activeState.explanationPanelVisible = visible;
    this.observer.onPlaybackStateChanged(this.activeState);
  }

  public async restoreDecorationsForVisibleEditor(editor: vscode.TextEditor | undefined): Promise<void> {
    const state = this.activeState;
    if (!editor || !state) {
      return;
    }

    const step = this.getCurrentStep(state);
    if (!this.decorations.matchesEditor(editor, this.workspaceRoot, step)) {
      this.decorations.clear();
      return;
    }

    this.decorations.apply(editor, step);
  }

  public stop(): void {
    this.activeState = null;
    this.decorations.clear();
    this.observer.onPlaybackStateChanged(null);
  }

  public dispose(): void {
    this.stop();
    this.decorations.dispose();
  }

  public async refreshPresentation(): Promise<void> {
    const state = this.activeState;
    if (!state) {
      return;
    }

    this.decorations.refreshStyles();
    const step = this.getCurrentStep(state);
    const editor = vscode.window.visibleTextEditors.find((candidate) =>
      this.decorations.matchesEditor(candidate, this.workspaceRoot, step),
    );

    if (editor) {
      this.decorations.apply(editor, step);
    }

    this.notify();
  }

  private canRevealIndex(index: number): boolean {
    return this.activeState !== null && index >= 0 && index < this.activeState.walkthrough.steps.length;
  }

  private getCurrentStep(state: PlaybackState): WalkthroughStep {
    return state.walkthrough.steps[state.currentStepIndex];
  }

  private notify(): void {
    if (this.activeState) {
      this.observer.onPlaybackStateChanged(this.activeState);
    }
  }

  private async revealStepAtIndex(index: number): Promise<void> {
    const state = this.activeState;
    if (!state || index < 0 || index >= state.walkthrough.steps.length) {
      return;
    }

    state.currentStepIndex = index;
    await this.revealStep(state, this.getCurrentStep(state));
  }

  private async revealStep(state: PlaybackState, step: WalkthroughStep): Promise<void> {
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
    const caretPosition = document.lineAt(step.range.end - 1).range.end;
    const topPaddingLines = getEditorTopPaddingLines();
    const revealLine = Math.max(0, step.range.start - 1 - topPaddingLines);
    const revealRange = document.lineAt(revealLine).range;

    editor.selection = new vscode.Selection(caretPosition, caretPosition);
    editor.revealRange(revealRange, vscode.TextEditorRevealType.AtTop);
    this.decorations.apply(editor, step);
    editor.revealRange(targetRange, vscode.TextEditorRevealType.Default);
    this.notify();
  }
}

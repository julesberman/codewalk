import * as path from "node:path";

import * as vscode from "vscode";

import { DecorationsManager } from "./decorations";
import {
  type PlaybackState,
  type ValidatedWalkthrough,
  type WalkthroughSummary,
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
  ) {}

  public getState(): PlaybackState | null {
    return this.activeState;
  }

  public async start(walkthrough: ValidatedWalkthrough): Promise<void> {
    this.stop();
    this.activeState = {
      walkthrough,
      currentStepIndex: 0,
    };
    await this.revealCurrentStep();
  }

  public async next(): Promise<void> {
    if (!this.activeState) {
      return;
    }

    const nextIndex = this.activeState.currentStepIndex + 1;
    if (nextIndex >= this.activeState.walkthrough.steps.length) {
      this.stop();
      return;
    }

    this.activeState.currentStepIndex = nextIndex;
    await this.revealCurrentStep();
  }

  public async previous(): Promise<void> {
    if (!this.activeState) {
      return;
    }

    const previousIndex = this.activeState.currentStepIndex - 1;
    if (previousIndex < 0) {
      return;
    }

    this.activeState.currentStepIndex = previousIndex;
    await this.revealCurrentStep();
  }

  public async jumpToStep(index: number): Promise<void> {
    if (!this.activeState) {
      return;
    }

    if (index < 0 || index >= this.activeState.walkthrough.steps.length) {
      return;
    }

    this.activeState.currentStepIndex = index;
    await this.revealCurrentStep();
  }

  public async restoreDecorationsForVisibleEditor(editor: vscode.TextEditor | undefined): Promise<void> {
    if (!editor || !this.activeState) {
      return;
    }

    const step = this.activeState.walkthrough.steps[this.activeState.currentStepIndex];
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

  private async revealCurrentStep(): Promise<void> {
    if (!this.activeState) {
      return;
    }

    const step = this.activeState.walkthrough.steps[this.activeState.currentStepIndex];
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

    editor.selection = new vscode.Selection(caretPosition, caretPosition);
    editor.revealRange(targetRange, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    this.decorations.apply(editor, step);
    this.observer.onPlaybackStateChanged(this.activeState);
  }
}

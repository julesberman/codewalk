import * as path from "node:path";

import * as vscode from "vscode";

import { getDimmingStrength, getHighlightColor } from "./config";
import { type WalkthroughStep } from "./types";

export class DecorationsManager implements vscode.Disposable {
  private activeDecoration = this.createActiveDecoration();
  private inactiveDecoration = this.createInactiveDecoration();

  public apply(editor: vscode.TextEditor, step: WalkthroughStep): void {
    this.clear();
    editor.setDecorations(this.activeDecoration, [toWholeLineRange(step)]);
    editor.setDecorations(this.inactiveDecoration, buildInactiveRanges(editor.document, step));
  }

  public clear(): void {
    for (const visibleEditor of vscode.window.visibleTextEditors) {
      visibleEditor.setDecorations(this.activeDecoration, []);
      visibleEditor.setDecorations(this.inactiveDecoration, []);
    }
  }

  public refreshStyles(): void {
    this.clear();
    this.activeDecoration.dispose();
    this.inactiveDecoration.dispose();
    this.activeDecoration = this.createActiveDecoration();
    this.inactiveDecoration = this.createInactiveDecoration();
  }

  public matchesEditor(editor: vscode.TextEditor, workspaceRoot: string, step: WalkthroughStep): boolean {
    const expected = path.normalize(path.join(workspaceRoot, step.file));
    return path.normalize(editor.document.uri.fsPath) === expected;
  }

  public dispose(): void {
    this.clear();
    this.activeDecoration.dispose();
    this.inactiveDecoration.dispose();
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

function buildInactiveRanges(
  document: vscode.TextDocument,
  step: WalkthroughStep,
): vscode.DecorationOptions[] {
  const inactiveRanges: vscode.DecorationOptions[] = [];
  const startLine = step.range.start - 1;
  const endLine = step.range.end - 1;

  for (let line = 0; line < document.lineCount; line += 1) {
    if (line >= startLine && line <= endLine) {
      continue;
    }

    inactiveRanges.push({
      range: document.lineAt(line).range,
    });
  }

  return inactiveRanges;
}

function toWholeLineRange(step: WalkthroughStep): vscode.Range {
  return new vscode.Range(
    new vscode.Position(step.range.start - 1, 0),
    new vscode.Position(step.range.end - 1, Number.MAX_SAFE_INTEGER),
  );
}

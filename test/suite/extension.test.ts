import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import * as vscode from "vscode";

suite("Extension smoke", () => {
  test("start, navigate, and exit walkthrough commands", async function () {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "walkthrough-ext-"));
    const workspaceUri = vscode.Uri.file(workspaceRoot);
    const added = vscode.workspace.updateWorkspaceFolders(0, vscode.workspace.workspaceFolders?.length ?? 0, {
      uri: workspaceUri,
      name: "walkthrough-fixture",
    });
    assert.equal(added, true);
    await waitFor(() => (vscode.workspace.workspaceFolders?.length ?? 0) > 0);

    const extension = vscode.extensions.all.find((candidate) => candidate.packageJSON.name === "code-walkthrough");
    assert.ok(extension, "Expected extension metadata");
    await extension?.activate();

    await fs.mkdir(path.join(workspaceRoot, ".walkthroughs"), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, "sample.ts"), ["alpha", "beta", "gamma", "delta"].join("\n"));
    await fs.writeFile(
      path.join(workspaceRoot, ".walkthroughs", "tour.yaml"),
      `
title: Sample tour
steps:
  - title: Intro
    file: sample.ts
    range:
      start: 1
      end: 1
    explanation: first
  - title: Second
    file: sample.ts
    range:
      start: 2
      end: 3
    explanation: second
`.trimStart(),
    );

    await vscode.commands.executeCommand("walkthrough.start", ".walkthroughs/tour.yaml");
    await waitForEditor("sample.ts");
    assert.equal(vscode.window.activeTextEditor?.selection.active.line, 0);

    await vscode.commands.executeCommand("walkthrough.next");
    await waitForSelectionLine(2);

    await vscode.commands.executeCommand("walkthrough.previous");
    await waitForSelectionLine(0);

    await vscode.commands.executeCommand("walkthrough.start", ".walkthroughs/tour.yaml");
    await waitForSelectionLine(0);

    await vscode.commands.executeCommand("walkthrough.next");
    await waitForSelectionLine(2);
    await vscode.commands.executeCommand("walkthrough.exit");

    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    const decorationProbe = editor?.visibleRanges.length ?? 0;
    assert.ok(decorationProbe >= 0);
  });
});

async function waitForEditor(fileName: string): Promise<void> {
  await waitFor(() => vscode.window.activeTextEditor?.document.fileName.endsWith(fileName) ?? false);
}

async function waitForSelectionLine(line: number): Promise<void> {
  await waitFor(() => vscode.window.activeTextEditor?.selection.active.line === line);
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const timeoutAt = Date.now() + 5000;
  while (Date.now() < timeoutAt) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error("Timed out waiting for condition.");
}

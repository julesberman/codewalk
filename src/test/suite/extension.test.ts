import * as assert from "node:assert/strict";

import * as vscode from "vscode";

import { createFixtureWorkspace } from "./fixtures";

suite("Extension smoke", () => {
  test("start, navigate, exit, and recover from an invalid walkthrough", async function () {
    const fixture = await createFixtureWorkspace("walkthrough-ext-");
    await fixture.writeWalkthrough(`
title: Sample tour
steps:
  - title: Intro
    file: src.ts
    range:
      start: 1
      end: 1
    explanation: first
  - title: Second
    file: src.ts
    range:
      start: 2
      end: 3
    explanation: second
`);
    await fixture.writeWalkthrough("title: broken:\nsteps: []\n", "broken.yaml");

    const added = vscode.workspace.updateWorkspaceFolders(0, vscode.workspace.workspaceFolders?.length ?? 0, {
      uri: vscode.Uri.file(fixture.root),
      name: "walkthrough-fixture",
    });
    assert.equal(added, true);
    await waitFor(() => (vscode.workspace.workspaceFolders?.length ?? 0) > 0);

    const extension = vscode.extensions.all.find((candidate) => candidate.packageJSON.name === "code-walkthrough");
    assert.ok(extension, "Expected extension metadata");
    await extension?.activate();

    await vscode.commands.executeCommand("walkthrough.start", ".walkthroughs/demo.yaml");
    await waitForEditor("src.ts");
    assert.equal(vscode.window.activeTextEditor?.selection.active.line, 0);

    await vscode.commands.executeCommand("walkthrough.next");
    await waitForSelectionLine(2);

    await vscode.commands.executeCommand("walkthrough.previous");
    await waitForSelectionLine(0);

    await vscode.commands.executeCommand("walkthrough.exit");

    await vscode.commands.executeCommand("walkthrough.start", ".walkthroughs/broken.yaml");
    await waitFor(() => (vscode.window.activeTextEditor?.document.fileName.endsWith("src.ts") ?? false));

    await vscode.commands.executeCommand("walkthrough.start", ".walkthroughs/demo.yaml");
    await waitForSelectionLine(0);
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

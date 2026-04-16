import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";

import { createFixtureWorkspace } from "./fixtures";
import { discoverWalkthroughs, loadWalkthrough } from "../../walkthroughs";

describe("walkthrough discovery", () => {
  it("sorts discovered walkthroughs by last updated time", async () => {
    const fixture = await createFixtureWorkspace("walkthrough-loader-");
    await fixture.writeWalkthrough(validWalkthrough("Older"), "older.yaml");
    await fixture.writeWalkthrough(validWalkthrough("Newer"), "newer.yaml");

    const olderPath = fixture.walkthroughPath("older.yaml");
    const newerPath = fixture.walkthroughPath("newer.yaml");
    const now = Date.now();
    await fs.utimes(olderPath, now / 1000, (now - 60_000) / 1000);
    await fs.utimes(newerPath, now / 1000, now / 1000);

    const walkthroughs = await discoverWalkthroughs(fixture.root);

    assert.deepEqual(
      walkthroughs.map((walkthrough) => walkthrough.fileName),
      ["newer.yaml", "older.yaml"],
    );
  });

  it("marks malformed yaml as broken during discovery", async () => {
    const fixture = await createFixtureWorkspace("walkthrough-loader-");
    await fixture.writeWalkthrough("title: demo:\nsteps: []\n", "broken.yaml");

    const walkthroughs = await discoverWalkthroughs(fixture.root);
    const broken = walkthroughs.find((walkthrough) => walkthrough.fileName === "broken.yaml");

    assert.ok(broken);
    assert.equal(broken.title, "broken");
    assert.match(broken.error?.title ?? "", /Invalid YAML/);
  });

  it("keeps unreadable walkthroughs visible in browse mode", async () => {
    const fixture = await createFixtureWorkspace("walkthrough-loader-");
    const unreadablePath = await fixture.writeWalkthrough(validWalkthrough("Hidden"), "hidden.yaml");
    await fs.chmod(unreadablePath, 0);

    try {
      const walkthroughs = await discoverWalkthroughs(fixture.root);
      const hidden = walkthroughs.find((walkthrough) => walkthrough.fileName === "hidden.yaml");

      assert.ok(hidden);
      assert.equal(hidden.title, "hidden");
      assert.equal(hidden.error, undefined);
    } finally {
      await fs.chmod(unreadablePath, 0o644);
    }
  });

  it("returns a missing-file error when an explicit load target disappears", async () => {
    const fixture = await createFixtureWorkspace("walkthrough-loader-");
    await fixture.writeWalkthrough(validWalkthrough("Demo"), "demo.yaml");
    await fs.rm(fixture.walkthroughPath("demo.yaml"));

    const result = await loadWalkthrough(fixture.root, ".walkthroughs/demo.yaml");

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.title, /Walkthrough file not found/);
      assert.match(result.error.detail, /no longer exists/);
    }
  });
});

function validWalkthrough(title: string): string {
  return `
title: ${title}
steps:
  - title: Intro
    file: src.ts
    range:
      start: 1
      end: 1
    explanation: ok
`.trimStart();
}

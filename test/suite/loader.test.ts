import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { WalkthroughLoader } from "../../src/walkthroughLoader";

describe("WalkthroughLoader", () => {
  let workspaceRoot: string;

  beforeEach(async () => {
    workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "walkthrough-loader-"));
    await fs.mkdir(path.join(workspaceRoot, ".walkthroughs"));
    await fs.writeFile(path.join(workspaceRoot, "src.ts"), ["one", "two", "three", "four"].join("\n"));
  });

  it("loads a valid walkthrough", async () => {
    await writeWalkthrough(
      workspaceRoot,
      `
title: Demo
description: Sample
steps:
  - title: Intro
    file: src.ts
    range:
      start: 1
      end: 2
    explanation: |
      Hello
`,
    );

    const loader = new WalkthroughLoader(workspaceRoot);
    const result = await loader.loadWalkthrough(".walkthroughs/demo.yaml");

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.walkthrough.title, "Demo");
      assert.equal(result.walkthrough.steps.length, 1);
    }
  });

  it("rejects YAML parse failures", async () => {
    await writeWalkthrough(workspaceRoot, "title: demo:\nsteps: []\n");
    const loader = new WalkthroughLoader(workspaceRoot);
    const result = await loader.loadWalkthrough(".walkthroughs/demo.yaml");

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.title, /Invalid YAML/);
    }
  });

  it("rejects unknown fields", async () => {
    await writeWalkthrough(
      workspaceRoot,
      `
title: Demo
steps:
  - title: Intro
    file: src.ts
    range:
      start: 1
      end: 1
    explanation: ok
extra: nope
`,
    );
    const loader = new WalkthroughLoader(workspaceRoot);
    const result = await loader.loadWalkthrough(".walkthroughs/demo.yaml");

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.detail, /unexpected property `extra`/);
    }
  });

  it("rejects missing required fields", async () => {
    await writeWalkthrough(
      workspaceRoot,
      `
title: Demo
steps:
  - title: Intro
    file: src.ts
    explanation: ok
`,
    );
    const loader = new WalkthroughLoader(workspaceRoot);
    const result = await loader.loadWalkthrough(".walkthroughs/demo.yaml");

    assert.equal(result.ok, false);
  });

  it("rejects trimmed empty title description and explanation", async () => {
    await writeWalkthrough(
      workspaceRoot,
      `
title: "   "
description: "   "
steps:
  - title: Intro
    file: src.ts
    range:
      start: 1
      end: 1
    explanation: "   "
`,
    );
    const loader = new WalkthroughLoader(workspaceRoot);
    const result = await loader.loadWalkthrough(".walkthroughs/demo.yaml");

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.detail, /title must not be empty/);
    }
  });

  it("rejects empty steps", async () => {
    await writeWalkthrough(
      workspaceRoot,
      `
title: Demo
steps: []
`,
    );
    const loader = new WalkthroughLoader(workspaceRoot);
    const result = await loader.loadWalkthrough(".walkthroughs/demo.yaml");

    assert.equal(result.ok, false);
  });

  it("rejects invalid ranges", async () => {
    await writeWalkthrough(
      workspaceRoot,
      `
title: Demo
steps:
  - title: Intro
    file: src.ts
    range:
      start: 3
      end: 2
    explanation: ok
`,
    );
    const loader = new WalkthroughLoader(workspaceRoot);
    const result = await loader.loadWalkthrough(".walkthroughs/demo.yaml");

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.detail, /range end must be greater than or equal/);
    }
  });

  it("rejects missing files", async () => {
    await writeWalkthrough(
      workspaceRoot,
      `
title: Demo
steps:
  - title: Intro
    file: missing.ts
    range:
      start: 1
      end: 1
    explanation: ok
`,
    );
    const loader = new WalkthroughLoader(workspaceRoot);
    const result = await loader.loadWalkthrough(".walkthroughs/demo.yaml");

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.detail, /does not exist/);
    }
  });

  it("rejects line ranges beyond the file length", async () => {
    await writeWalkthrough(
      workspaceRoot,
      `
title: Demo
steps:
  - title: Intro
    file: src.ts
    range:
      start: 1
      end: 99
    explanation: ok
`,
    );
    const loader = new WalkthroughLoader(workspaceRoot);
    const result = await loader.loadWalkthrough(".walkthroughs/demo.yaml");

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.detail, /only has 4 lines/);
    }
  });

  it("discovers walkthroughs sorted by last updated date", async () => {
    await writeWalkthrough(
      workspaceRoot,
      `
title: Older
steps:
  - title: Intro
    file: src.ts
    range:
      start: 1
      end: 1
    explanation: ok
`,
      "older.yaml",
    );
    await writeWalkthrough(
      workspaceRoot,
      `
title: Newer
steps:
  - title: Intro
    file: src.ts
    range:
      start: 1
      end: 1
    explanation: ok
`,
      "newer.yaml",
    );

    const olderPath = path.join(workspaceRoot, ".walkthroughs", "older.yaml");
    const newerPath = path.join(workspaceRoot, ".walkthroughs", "newer.yaml");
    const now = Date.now();
    await fs.utimes(olderPath, now / 1000, (now - 60_000) / 1000);
    await fs.utimes(newerPath, now / 1000, now / 1000);

    const loader = new WalkthroughLoader(workspaceRoot);
    const walkthroughs = await loader.discoverWalkthroughs();

    assert.deepEqual(
      walkthroughs.map((walkthrough) => walkthrough.fileName),
      ["newer.yaml", "older.yaml"],
    );
    assert.match(String(walkthroughs[0]?.updatedAt), /^\d/);
  });

  it("marks malformed YAML as broken during discovery", async () => {
    await writeWalkthrough(workspaceRoot, "title: demo:\nsteps: []\n", "malformed-YAML.yaml");

    const loader = new WalkthroughLoader(workspaceRoot);
    const walkthroughs = await loader.discoverWalkthroughs();
    const malformed = walkthroughs.find((walkthrough) => walkthrough.fileName === "malformed-YAML.yaml");

    assert.ok(malformed);
    assert.equal(malformed.title, "malformed-YAML");
    assert.match(malformed.error?.title ?? "", /Invalid YAML/);
  });

  it("uses the same validation pipeline for discovery and explicit load", async () => {
    await writeWalkthrough(
      workspaceRoot,
      `
title: Demo
steps:
  - title: Intro
    file: missing.ts
    range:
      start: 1
      end: 1
    explanation: ok
`,
      "broken.yaml",
    );

    const loader = new WalkthroughLoader(workspaceRoot);
    const walkthroughs = await loader.discoverWalkthroughs();
    const discovered = walkthroughs.find((walkthrough) => walkthrough.fileName === "broken.yaml");
    const loaded = await loader.loadWalkthrough(".walkthroughs/broken.yaml");

    assert.ok(discovered?.error);
    assert.equal(loaded.ok, false);
    if (discovered?.error && !loaded.ok) {
      assert.equal(discovered.error.title, loaded.error.title);
      assert.equal(discovered.error.detail, loaded.error.detail);
    }
  });
});

async function writeWalkthrough(
  workspaceRoot: string,
  contents: string,
  fileName = "demo.yaml",
): Promise<void> {
  await fs.writeFile(path.join(workspaceRoot, ".walkthroughs", fileName), contents.trimStart());
}

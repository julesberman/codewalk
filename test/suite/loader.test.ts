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
});

async function writeWalkthrough(workspaceRoot: string, contents: string): Promise<void> {
  await fs.writeFile(path.join(workspaceRoot, ".walkthroughs", "demo.yaml"), contents.trimStart());
}

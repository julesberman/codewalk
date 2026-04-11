import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { validateWalkthroughFile } from "../../src/walkthroughValidation";

const execFileAsync = promisify(execFile);

describe("walkthrough validator", () => {
  let workspaceRoot: string;

  beforeEach(async () => {
    workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "walkthrough-validator-"));
    await fs.mkdir(path.join(workspaceRoot, ".walkthroughs"));
    await fs.writeFile(path.join(workspaceRoot, "src.ts"), ["one", "two", "three", "four"].join("\n"));
  });

  it("accepts a valid walkthrough file", async () => {
    const walkthroughPath = await writeWalkthrough(
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

    const result = await validateWalkthroughFile(walkthroughPath, workspaceRoot);

    assert.equal(result.ok, true);
  });

  it("rejects malformed YAML", async () => {
    const walkthroughPath = await writeWalkthrough(workspaceRoot, "title: demo:\nsteps: []\n");
    const result = await validateWalkthroughFile(walkthroughPath, workspaceRoot);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.title, /Invalid YAML/);
    }
  });

  it("rejects unexpected schema properties", async () => {
    const walkthroughPath = await writeWalkthrough(
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
    const result = await validateWalkthroughFile(walkthroughPath, workspaceRoot);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.detail, /unexpected property `extra`/);
    }
  });

  it("rejects missing required fields", async () => {
    const walkthroughPath = await writeWalkthrough(
      workspaceRoot,
      `
title: Demo
steps:
  - title: Intro
    file: src.ts
    explanation: ok
`,
    );
    const result = await validateWalkthroughFile(walkthroughPath, workspaceRoot);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.title, /Schema validation failed/);
    }
  });

  it("rejects missing referenced files", async () => {
    const walkthroughPath = await writeWalkthrough(
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
    const result = await validateWalkthroughFile(walkthroughPath, workspaceRoot);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.detail, /does not exist/);
    }
  });

  it("rejects inverted line ranges", async () => {
    const walkthroughPath = await writeWalkthrough(
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
    const result = await validateWalkthroughFile(walkthroughPath, workspaceRoot);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.detail, /range end must be greater than or equal/);
    }
  });

  it("rejects line ranges beyond the file length", async () => {
    const walkthroughPath = await writeWalkthrough(
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
    const result = await validateWalkthroughFile(walkthroughPath, workspaceRoot);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.detail, /only has 4 lines/);
    }
  });

  it("validates walkthroughs through the CLI", async () => {
    const validPath = await writeWalkthrough(
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
`,
      "valid.yaml",
    );
    const invalidPath = await writeWalkthrough(
      workspaceRoot,
      `
title: Demo
steps:
  - title: Intro
    file: src.ts
    range:
      start: 9
      end: 10
    explanation: ok
`,
      "invalid.yaml",
    );

    const scriptPath = path.resolve(__dirname, "../../scripts/validateWalkthrough.js");
    const validRun = await execFileAsync(process.execPath, [scriptPath, validPath], {
      cwd: path.resolve(__dirname, "../.."),
    });

    assert.match(validRun.stdout, /Walkthrough validation passed/);

    await assert.rejects(
      execFileAsync(process.execPath, [scriptPath, invalidPath], {
        cwd: path.resolve(__dirname, "../.."),
      }),
      (error: unknown) => {
        assert.ok(error && typeof error === "object");
        const execError = error as { code?: number; stderr?: string };
        assert.equal(execError.code, 1);
        assert.match(execError.stderr ?? "", /Validation failed/);
        assert.match(execError.stderr ?? "", /only has 4 lines/);
        return true;
      },
    );
  });
});

async function writeWalkthrough(
  workspaceRoot: string,
  contents: string,
  fileName = "demo.yaml",
): Promise<string> {
  const absolutePath = path.join(workspaceRoot, ".walkthroughs", fileName);
  await fs.writeFile(absolutePath, contents.trimStart());
  return absolutePath;
}

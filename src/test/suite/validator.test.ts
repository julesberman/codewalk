import * as assert from "node:assert/strict";
import { execFile } from "node:child_process";
import * as path from "node:path";
import { promisify } from "node:util";

import { createFixtureWorkspace } from "./fixtures";
import { validateWalkthroughFile } from "../../walkthroughs";

const execFileAsync = promisify(execFile);

describe("walkthrough validator", () => {
  it("accepts a valid walkthrough file", async () => {
    const fixture = await createFixtureWorkspace("walkthrough-validator-");
    const walkthroughPath = await fixture.writeWalkthrough(validWalkthrough());

    const result = await validateWalkthroughFile(walkthroughPath, fixture.root);

    assert.equal(result.ok, true);
  });

  it("rejects malformed yaml", async () => {
    const fixture = await createFixtureWorkspace("walkthrough-validator-");
    const walkthroughPath = await fixture.writeWalkthrough("title: demo:\nsteps: []\n");

    const result = await validateWalkthroughFile(walkthroughPath, fixture.root);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.title, /Invalid YAML/);
    }
  });

  it("rejects unexpected schema properties", async () => {
    const fixture = await createFixtureWorkspace("walkthrough-validator-");
    const walkthroughPath = await fixture.writeWalkthrough(`
title: Demo
steps:
  - title: Intro
    file: src.ts
    range:
      start: 1
      end: 1
    explanation: ok
extra: nope
`);

    const result = await validateWalkthroughFile(walkthroughPath, fixture.root);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.detail, /unexpected property `extra`/);
    }
  });

  it("rejects trimmed empty content", async () => {
    const fixture = await createFixtureWorkspace("walkthrough-validator-");
    const walkthroughPath = await fixture.writeWalkthrough(`
title: "   "
description: "   "
steps:
  - title: Intro
    file: src.ts
    range:
      start: 1
      end: 1
    explanation: "   "
`);

    const result = await validateWalkthroughFile(walkthroughPath, fixture.root);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.detail, /title must not be empty/);
    }
  });

  it("rejects missing referenced files", async () => {
    const fixture = await createFixtureWorkspace("walkthrough-validator-");
    const walkthroughPath = await fixture.writeWalkthrough(`
title: Demo
steps:
  - title: Intro
    file: missing.ts
    range:
      start: 1
      end: 1
    explanation: ok
`);

    const result = await validateWalkthroughFile(walkthroughPath, fixture.root);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.detail, /does not exist/);
    }
  });

  it("rejects inverted line ranges", async () => {
    const fixture = await createFixtureWorkspace("walkthrough-validator-");
    const walkthroughPath = await fixture.writeWalkthrough(`
title: Demo
steps:
  - title: Intro
    file: src.ts
    range:
      start: 3
      end: 2
    explanation: ok
`);

    const result = await validateWalkthroughFile(walkthroughPath, fixture.root);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.detail, /range end must be greater than or equal/);
    }
  });

  it("rejects line ranges beyond the file length", async () => {
    const fixture = await createFixtureWorkspace("walkthrough-validator-");
    const walkthroughPath = await fixture.writeWalkthrough(`
title: Demo
steps:
  - title: Intro
    file: src.ts
    range:
      start: 1
      end: 99
    explanation: ok
`);

    const result = await validateWalkthroughFile(walkthroughPath, fixture.root);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error.detail, /only has 4 lines/);
    }
  });

  it("validates walkthroughs through the cli", async () => {
    const fixture = await createFixtureWorkspace("walkthrough-validator-");
    const validPath = await fixture.writeWalkthrough(validWalkthrough(), "valid.yaml");
    const invalidPath = await fixture.writeWalkthrough(`
title: Demo
steps:
  - title: Intro
    file: src.ts
    range:
      start: 9
      end: 10
    explanation: ok
`, "invalid.yaml");

    const scriptPath = path.resolve(__dirname, "../../../dev/validateWalkthrough.js");
    const validRun = await execFileAsync(process.execPath, [scriptPath, validPath], {
      cwd: path.resolve(__dirname, "../../.."),
    });

    assert.match(validRun.stdout, /Walkthrough validation passed/);

    await assert.rejects(
      execFileAsync(process.execPath, [scriptPath, invalidPath], {
        cwd: path.resolve(__dirname, "../../.."),
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

function validWalkthrough(): string {
  return `
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
`.trimStart();
}

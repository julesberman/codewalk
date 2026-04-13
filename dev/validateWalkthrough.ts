import * as path from "node:path";

import { validateWalkthroughFile } from "../src/walkthroughValidation";

async function main(): Promise<void> {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error("Usage: npm run validate:walkthrough -- <path-to-.walkthroughs/*.yaml>");
    process.exitCode = 1;
    return;
  }

  const absolutePath = path.resolve(inputPath);
  const walkthroughDir = path.dirname(absolutePath);

  if (path.basename(walkthroughDir) !== ".walkthroughs") {
    console.error(`Validation failed for ${inputPath}`);
    console.error("Walkthrough files must live inside a `.walkthroughs` directory.");
    process.exitCode = 1;
    return;
  }

  const workspaceRoot = path.dirname(walkthroughDir);
  const result = await validateWalkthroughFile(absolutePath, workspaceRoot);

  if (result.ok) {
    console.log(`Walkthrough validation passed: ${inputPath}`);
    return;
  }

  console.error(`Validation failed for ${inputPath}`);
  console.error(`${result.error.title}: ${result.error.detail}`);
  process.exitCode = 1;
}

void main().catch((error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error("Walkthrough validation failed unexpectedly.");
  console.error(detail);
  process.exitCode = 1;
});

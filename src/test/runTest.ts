import * as path from "node:path";
import * as fs from "node:fs/promises";

import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, "..", "..", "..");
  const extensionTestsPath = path.resolve(__dirname, "suite", "index.js");
  const vscodeTestRoot = path.join(extensionDevelopmentPath, ".vscode-test");
  const vscodeExecutablePath = await downloadAndUnzipVSCode("stable");

  try {
    await runTests({
      vscodeExecutablePath: path.join(
        path.dirname(path.dirname(vscodeExecutablePath)),
        "Resources",
        "app",
        "bin",
        "code",
      ),
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [],
    });
  } finally {
    await removeVSCodeTestRoot(vscodeTestRoot);
  }
}

async function removeVSCodeTestRoot(targetPath: string): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!isRetryableFsError(error) || attempt === 4) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}

function isRetryableFsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENOTEMPTY" || error.code === "EBUSY")
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import * as path from "node:path";

import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, "..", "..");
  const extensionTestsPath = path.resolve(__dirname, "suite", "index.js");
  const vscodeExecutablePath = await downloadAndUnzipVSCode("stable");

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
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

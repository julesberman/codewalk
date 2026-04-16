import * as path from "node:path";

import Mocha = require("mocha");

export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: "bdd",
    color: true,
  });

  for (const file of [
    "config.test.js",
    "loader.test.js",
    "playback.test.js",
    "uiTokens.test.js",
    "validator.test.js",
    "webview.test.js",
    "extension.test.js",
  ]) {
    mocha.addFile(path.resolve(__dirname, file));
  }

  await new Promise<void>((resolve, reject) => {
    mocha.run((failures: number) => {
      if (failures > 0) {
        reject(new Error(`${failures} tests failed.`));
        return;
      }

      resolve();
    });
  });
}

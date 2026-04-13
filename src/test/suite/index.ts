import * as path from "node:path";

import Mocha = require("mocha");

export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: "bdd",
    color: true,
  });

  mocha.addFile(path.resolve(__dirname, "loader.test.js"));
  mocha.addFile(path.resolve(__dirname, "uiTokens.test.js"));
  mocha.addFile(path.resolve(__dirname, "validator.test.js"));
  mocha.addFile(path.resolve(__dirname, "extension.test.js"));

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

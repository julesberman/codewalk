import { accessSync, constants } from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demoPath = path.join(workspaceRoot, "demo");

function isExecutable(filePath) {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function commandExists(command) {
  const result = spawnSync("sh", ["-lc", `command -v "${command}"`], {
    stdio: "pipe"
  });
  return result.status === 0;
}

function resolveCodeCommand() {
  const candidates = [];

  if (process.env.VSCODE_BIN) {
    candidates.push(process.env.VSCODE_BIN);
  }

  candidates.push("code");
  candidates.push("code-insiders");
  candidates.push("/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code");
  candidates.push("/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code");

  for (const candidate of candidates) {
    if (candidate.includes(path.sep)) {
      if (isExecutable(candidate)) {
        return candidate;
      }
      continue;
    }

    if (commandExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function runOrExit(command, args) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const codeCommand = resolveCodeCommand();

runOrExit("npm", ["run", "compile"]);

const watcher = spawn("npx", ["tsc", "--watch", "-p", "./"], {
  cwd: workspaceRoot,
  stdio: "inherit"
});

watcher.on("exit", (code) => {
  process.exit(code ?? 0);
});

process.on("SIGINT", () => watcher.kill("SIGINT"));
process.on("SIGTERM", () => watcher.kill("SIGTERM"));

if (!codeCommand) {
  console.error("");
  console.error("Unable to find the VS Code CLI.");
  console.error("Install the `code` shell command or set VSCODE_BIN to your VS Code binary.");
  console.error(`The TypeScript watcher is still running. Open ${demoPath} manually if needed.`);
} else {
  const launchArgs = [
    "--new-window",
    `--extensionDevelopmentPath=${workspaceRoot}`,
    demoPath
  ];

  const launchResult = spawnSync(codeCommand, launchArgs, {
    cwd: workspaceRoot,
    stdio: "inherit"
  });

  if (launchResult.status !== 0) {
    console.error("");
    console.error("VS Code did not launch successfully.");
    console.error(`Tried: ${codeCommand} ${launchArgs.join(" ")}`);
  }
}

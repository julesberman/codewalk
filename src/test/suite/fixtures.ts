import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const DEFAULT_SOURCE_PATH = "src.ts";
const DEFAULT_SOURCE_LINES = ["one", "two", "three", "four"];

export interface FixtureWorkspace {
  root: string;
  walkthroughDir: string;
  filePath(relativePath: string): string;
  walkthroughPath(fileName?: string): string;
  writeFile(relativePath: string, contents: string | string[]): Promise<string>;
  writeWalkthrough(contents: string, fileName?: string): Promise<string>;
}

export async function createFixtureWorkspace(prefix: string): Promise<FixtureWorkspace> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const walkthroughDir = path.join(root, ".walkthroughs");
  await fs.mkdir(walkthroughDir, { recursive: true });
  await fs.writeFile(path.join(root, DEFAULT_SOURCE_PATH), DEFAULT_SOURCE_LINES.join("\n"));

  return {
    root,
    walkthroughDir,
    filePath: (relativePath: string) => path.join(root, relativePath),
    walkthroughPath: (fileName = "demo.yaml") => path.join(walkthroughDir, fileName),
    writeFile: async (relativePath: string, contents: string | string[]) =>
      writeFile(root, relativePath, contents),
    writeWalkthrough: async (contents: string, fileName = "demo.yaml") =>
      writeFile(root, path.join(".walkthroughs", fileName), contents.trimStart()),
  };
}

async function writeFile(root: string, relativePath: string, contents: string | string[]): Promise<string> {
  const absolutePath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, Array.isArray(contents) ? contents.join("\n") : contents);
  return absolutePath;
}

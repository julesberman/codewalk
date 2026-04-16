import * as fs from "node:fs/promises";
import { type Dirent } from "node:fs";
import * as path from "node:path";

import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import * as yaml from "js-yaml";

import { getWalkLibraryLocation, toAbsoluteLibraryPath } from "./config";
import schema from "./walkthrough.schema.json";
import { type Walkthrough, type WalkthroughErrorState, type WalkthroughSummary } from "./types";

type WalkthroughDocumentFields = Pick<Walkthrough, "title" | "description" | "steps">;
type WalkthroughDocumentResult =
  | { ok: true; document: WalkthroughDocumentFields }
  | { ok: false; error: WalkthroughErrorState };

export type WalkthroughResult =
  | { ok: true; walkthrough: Walkthrough }
  | { ok: false; error: WalkthroughErrorState };

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
});

const validateSchema = ajv.compile<WalkthroughDocumentFields>(schema);
const WALKTHROUGH_FILE_PATTERN = /\.(yaml|yml)$/i;
const MISSING_FILE_TITLE = "Walkthrough file not found";

interface WalkthroughSource {
  fileName: string;
  relativePath: string;
  absolutePath: string;
  updatedAt: number;
}

export async function discoverWalkthroughs(workspaceRoot: string): Promise<WalkthroughSummary[]> {
  const files = await listWalkthroughFiles(workspaceRoot);
  return Promise.all(files.map((file) => summarizeWalkthrough(file, workspaceRoot)));
}

export async function loadWalkthrough(workspaceRoot: string, relativePath: string): Promise<WalkthroughResult> {
  const normalizedRelativePath = normalizeRelativePath(relativePath);
  return readWalkthrough(
    createWalkthroughSource(workspaceRoot, normalizedRelativePath),
    workspaceRoot,
    `The file \`${relativePath}\` no longer exists.`,
  );
}

export async function validateWalkthroughFile(
  absolutePath: string,
  workspaceRoot: string,
): Promise<WalkthroughResult> {
  const relativePath = normalizeRelativePath(path.relative(workspaceRoot, absolutePath));
  return readWalkthrough(
    createWalkthroughSource(workspaceRoot, relativePath, absolutePath),
    workspaceRoot,
    `The file \`${absolutePath}\` does not exist.`,
  );
}

async function listWalkthroughFiles(workspaceRoot: string): Promise<WalkthroughSource[]> {
  const libraryLocation = getWalkLibraryLocation();
  const directory = toAbsoluteLibraryPath(workspaceRoot);
  let entries: Dirent[];

  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && WALKTHROUGH_FILE_PATTERN.test(entry.name))
      .map(async (entry) => {
        const absolutePath = path.join(directory, entry.name);
        const stats = await fs.stat(absolutePath);
        return createWalkthroughSource(
          workspaceRoot,
          path.posix.join(libraryLocation, entry.name),
          absolutePath,
          stats.mtimeMs,
        );
      }),
  );

  return files.sort((left, right) => right.updatedAt - left.updatedAt || left.fileName.localeCompare(right.fileName));
}

async function summarizeWalkthrough(source: WalkthroughSource, workspaceRoot: string): Promise<WalkthroughSummary> {
  const summary = toSummary(source);

  try {
    const result = await readWalkthrough(source, workspaceRoot, `The file \`${source.relativePath}\` no longer exists.`);
    return result.ok
      ? {
          ...summary,
          title: result.walkthrough.title.trim() || summary.title,
          description: getNonEmptyString(result.walkthrough.description),
        }
      : {
          ...summary,
          error: result.error,
        };
  } catch {
    return summary;
  }
}

function createWalkthroughSource(
  workspaceRoot: string,
  relativePath: string,
  absolutePath = path.join(workspaceRoot, relativePath),
  updatedAt = 0,
): WalkthroughSource {
  const normalizedRelativePath = normalizeRelativePath(relativePath);
  const fileName = path.basename(normalizedRelativePath);

  return {
    fileName,
    relativePath: normalizedRelativePath,
    absolutePath,
    updatedAt,
  };
}

function toSummary(source: WalkthroughSource): WalkthroughSummary {
  return {
    fileName: source.fileName,
    relativePath: source.relativePath,
    title: stripExtension(source.fileName),
  };
}

async function readWalkthrough(
  source: WalkthroughSource,
  workspaceRoot: string,
  missingDetail: string,
): Promise<WalkthroughResult> {
  let raw: string;

  try {
    raw = await fs.readFile(source.absolutePath, "utf8");
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return {
        ok: false,
        error: createError(source.fileName, MISSING_FILE_TITLE, missingDetail),
      };
    }

    throw error;
  }

  const parsed = await parseWalkthroughSource(raw, source.fileName, workspaceRoot);
  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true,
    walkthrough: {
      title: parsed.document.title,
      fileName: source.fileName,
      relativePath: source.relativePath,
      description: parsed.document.description,
      steps: parsed.document.steps,
    },
  };
}

async function parseWalkthroughSource(
  raw: string,
  fileName: string,
  workspaceRoot: string,
): Promise<WalkthroughDocumentResult> {
  let parsed: unknown;

  try {
    parsed = yaml.load(raw);
  } catch (error) {
    return {
      ok: false,
      error: createError(fileName, "Invalid YAML", formatYamlError(error)),
    };
  }

  if (!validateSchema(parsed)) {
    return {
      ok: false,
      error: createError(fileName, "Schema validation failed", formatSchemaErrors(validateSchema.errors ?? [])),
    };
  }

  const semanticError = await validateSemantics(parsed, workspaceRoot);
  if (semanticError) {
    return {
      ok: false,
      error: createError(fileName, "Walkthrough validation failed", semanticError),
    };
  }

  return {
    ok: true,
    document: parsed,
  };
}

async function validateSemantics(
  document: WalkthroughDocumentFields,
  workspaceRoot: string,
): Promise<string | null> {
  if (document.title.trim().length === 0) {
    return "The walkthrough title must not be empty or whitespace only.";
  }

  if (document.description !== undefined && document.description.trim().length === 0) {
    return "The walkthrough description must not be empty or whitespace only.";
  }

  const lineCountCache = new Map<string, number>();

  for (const [index, step] of document.steps.entries()) {
    if (step.title.trim().length === 0) {
      return `Step ${index + 1} title must not be empty or whitespace only.`;
    }

    if (step.explanation.trim().length === 0) {
      return `Step ${index + 1} explanation must not be empty or whitespace only.`;
    }

    if (step.range.end < step.range.start) {
      return `Step ${index + 1} range end must be greater than or equal to range start.`;
    }

    const fileLineCount = await readLineCount(path.join(workspaceRoot, step.file), lineCountCache);
    if (fileLineCount === null) {
      return `Step ${index + 1} references \`${step.file}\`, but that file does not exist.`;
    }

    if (step.range.end > fileLineCount) {
      return `Step ${index + 1} references lines ${step.range.start}-${step.range.end} in \`${step.file}\`, but the file only has ${fileLineCount} lines.`;
    }
  }

  return null;
}

async function readLineCount(absolutePath: string, cache: Map<string, number>): Promise<number | null> {
  const cached = cache.get(absolutePath);
  if (cached !== undefined) {
    return cached;
  }

  let contents: string;

  try {
    contents = await fs.readFile(absolutePath, "utf8");
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return null;
    }

    throw error;
  }

  const lineCount = countLines(contents);
  cache.set(absolutePath, lineCount);
  return lineCount;
}

function countLines(contents: string): number {
  if (contents.length === 0) {
    return 1;
  }

  return contents.split(/\r?\n/).length;
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.(yaml|yml)$/i, "");
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function createError(fileName: string, title: string, detail: string): WalkthroughErrorState {
  return {
    title,
    detail,
    fileName,
  };
}

function formatSchemaErrors(errors: ErrorObject[]): string {
  return errors
    .map((error) => {
      const location = error.instancePath.length > 0 ? error.instancePath : "document";
      if (error.keyword === "additionalProperties" && error.params && "additionalProperty" in error.params) {
        return `${location}: unexpected property \`${String(error.params.additionalProperty)}\`.`;
      }

      return `${location}: ${error.message ?? "validation failed"}.`;
    })
    .join(" ");
}

function formatYamlError(error: unknown): string {
  return error instanceof Error ? error.message : "The walkthrough file could not be parsed as YAML.";
}

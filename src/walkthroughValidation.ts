import * as fs from "node:fs/promises";
import * as path from "node:path";

import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import * as yaml from "js-yaml";

import schema from "../walkthrough.schema.json";
import { type WalkthroughDocument, type WalkthroughErrorState } from "./types";

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
});

const validateSchema = ajv.compile<WalkthroughDocument>(schema);

export type DocumentValidationResult =
  | { ok: true; document: WalkthroughDocument }
  | { ok: false; error: WalkthroughErrorState };

export async function validateWalkthroughFile(
  absolutePath: string,
  workspaceRoot: string,
): Promise<DocumentValidationResult> {
  let raw: string;

  try {
    raw = await fs.readFile(absolutePath, "utf8");
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return {
        ok: false,
        error: createError(path.basename(absolutePath), "Walkthrough file not found", `The file \`${absolutePath}\` does not exist.`),
      };
    }

    throw error;
  }

  return parseWalkthroughDocument(raw, path.basename(absolutePath), workspaceRoot);
}

export async function parseWalkthroughDocument(
  raw: string,
  fileName: string,
  workspaceRoot: string,
): Promise<DocumentValidationResult> {
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

  const semanticError = await validateWalkthroughSemantics(parsed, workspaceRoot);
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

export async function validateWalkthroughSemantics(
  document: WalkthroughDocument,
  workspaceRoot: string,
): Promise<string | null> {
  const title = document.title.trim();
  if (title.length === 0) {
    return "The walkthrough title must not be empty or whitespace only.";
  }

  if (document.description !== undefined && document.description.trim().length === 0) {
    return "The walkthrough description must not be empty or whitespace only.";
  }

  for (const [index, step] of document.steps.entries()) {
    if (step.title.trim().length === 0) {
      return `Step ${index + 1} title must not be empty or whitespace only.`;
    }

    if (step.explanation.trim().length === 0) {
      return `Step ${index + 1} explanation must not be empty or whitespace only.`;
    }

    if (step.range.start < 1 || step.range.end < 1) {
      return `Step ${index + 1} range values must be at least 1.`;
    }

    if (step.range.end < step.range.start) {
      return `Step ${index + 1} range end must be greater than or equal to range start.`;
    }

    const absoluteFilePath = path.join(workspaceRoot, step.file);

    let fileContents: string;
    try {
      fileContents = await fs.readFile(absoluteFilePath, "utf8");
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return `Step ${index + 1} references \`${step.file}\`, but that file does not exist.`;
      }

      throw error;
    }

    const lineCount = countLines(fileContents);
    if (step.range.end > lineCount) {
      return `Step ${index + 1} references lines ${step.range.start}-${step.range.end} in \`${step.file}\`, but the file only has ${lineCount} lines.`;
    }
  }

  return null;
}

function createError(fileName: string, title: string, detail: string): WalkthroughErrorState {
  return {
    title,
    detail,
    fileName,
  };
}

function countLines(contents: string): number {
  if (contents.length === 0) {
    return 1;
  }

  return contents.split(/\r?\n/).length;
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
  if (error instanceof Error) {
    return error.message;
  }

  return "The walkthrough file could not be parsed as YAML.";
}

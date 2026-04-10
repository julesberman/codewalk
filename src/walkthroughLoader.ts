import * as fs from "node:fs/promises";
import * as path from "node:path";

import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import * as yaml from "js-yaml";

import schema from "../walkthrough.schema.json";
import { getWalkLibraryLocation, toAbsoluteLibraryPath } from "./config";
import {
  type ValidatedWalkthrough,
  type WalkthroughDocument,
  type WalkthroughErrorState,
  type WalkthroughFile,
  type WalkthroughSummary,
} from "./types";

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
});

const validateSchema = ajv.compile<WalkthroughDocument>(schema);

type ValidationResult =
  | { ok: true; walkthrough: ValidatedWalkthrough }
  | { ok: false; error: WalkthroughErrorState };

type DocumentValidationResult =
  | { ok: true; document: WalkthroughDocument }
  | { ok: false; error: WalkthroughErrorState };

export class WalkthroughLoader {
  public constructor(private readonly workspaceRoot: string) {}

  public async discoverWalkthroughs(): Promise<WalkthroughSummary[]> {
    const libraryLocation = getWalkLibraryLocation();
    const walkthroughDir = toAbsoluteLibraryPath(this.workspaceRoot);
    let entries: string[];

    try {
      entries = await fs.readdir(walkthroughDir);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return [];
      }

      throw error;
    }

    const candidates = entries.filter((entry) => entry.endsWith(".yaml") || entry.endsWith(".yml"));

    const summaries = await Promise.all(
      candidates.map((fileName) => this.discoverWalkthroughSummary(fileName, libraryLocation, walkthroughDir)),
    );

    return summaries.sort(
      (left, right) => right.updatedAt - left.updatedAt || left.fileName.localeCompare(right.fileName),
    );
  }

  public async loadWalkthrough(relativePath: string): Promise<ValidationResult> {
    const walkthroughFile = this.toWalkthroughFile(relativePath);
    let raw: string;

    try {
      raw = await fs.readFile(walkthroughFile.absolutePath, "utf8");
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return {
          ok: false,
          error: createError(
            walkthroughFile.fileName,
            "Walkthrough file not found",
            `The file \`${relativePath}\` no longer exists.`,
          ),
        };
      }

      throw error;
    }

    const result = await this.parseDocument(raw, walkthroughFile.fileName);
    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
      };
    }

    return {
      ok: true,
      walkthrough: {
        ...walkthroughFile,
        ...result.document,
      },
    };
  }

  private async discoverWalkthroughSummary(
    fileName: string,
    libraryLocation: string,
    walkthroughDir: string,
  ): Promise<WalkthroughSummary> {
    const absolutePath = path.join(walkthroughDir, fileName);
    const baseSummary = await this.createBaseSummary(fileName, libraryLocation, absolutePath);

    try {
      const raw = await fs.readFile(absolutePath, "utf8");
      const result = await this.parseDocument(raw, fileName);
      if (!result.ok) {
        return {
          ...baseSummary,
          error: result.error,
        };
      }

      return {
        ...baseSummary,
        title: result.document.title.trim() || baseSummary.title,
        description: getNonEmptyString(result.document.description),
      };
    } catch {
      // Unreadable files should still appear in browse mode.
      return baseSummary;
    }
  }

  private async createBaseSummary(
    fileName: string,
    libraryLocation: string,
    absolutePath: string,
  ): Promise<WalkthroughSummary> {
    const relativePath = path.posix.join(libraryLocation, fileName);
    const stats = await fs.stat(absolutePath);
    return {
      id: relativePath,
      fileName,
      relativePath,
      title: stripExtension(fileName),
      updatedAt: stats.mtimeMs,
    };
  }

  private async parseDocument(raw: string, fileName: string): Promise<DocumentValidationResult> {
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

    const semanticError = await this.validateSemantics(parsed);
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

  private async validateSemantics(document: WalkthroughDocument): Promise<string | null> {
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

      const absoluteFilePath = path.join(this.workspaceRoot, step.file);

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

  private toWalkthroughFile(relativePath: string): WalkthroughFile {
    const normalized = relativePath.replace(/\\/g, "/");
    const fileName = path.basename(normalized);
    return {
      id: normalized,
      fileName,
      relativePath: normalized,
      title: stripExtension(fileName),
      updatedAt: 0,
      absolutePath: path.join(this.workspaceRoot, normalized),
    };
  }
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.(yaml|yml)$/i, "");
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

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
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

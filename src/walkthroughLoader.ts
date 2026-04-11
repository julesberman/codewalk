import * as fs from "node:fs/promises";
import * as path from "node:path";

import { getWalkLibraryLocation, toAbsoluteLibraryPath } from "./config";
import {
  type ValidatedWalkthrough,
  type WalkthroughErrorState,
  type WalkthroughFile,
  type WalkthroughSummary,
} from "./types";
import { type DocumentValidationResult, parseWalkthroughDocument } from "./walkthroughValidation";

type ValidationResult =
  | { ok: true; walkthrough: ValidatedWalkthrough }
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
    return parseWalkthroughDocument(raw, fileName, this.workspaceRoot);
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

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

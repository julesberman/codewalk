---
name: codewalk-yaml-contract
description: Build a new valid walkthrough YAML file for this VS Code extension. Use when the task is to author a `.walkthroughs/*.yaml` or `.walkthroughs/*.yml` file that must satisfy the walkthrough schema and line-range rules. This skill defines the YAML contract and post-write validation workflow, not the walkthrough's teaching style or content strategy; this should be handled by another skill or specific user instructions. 
---

# Walkthrough

Create a new walkthrough YAML file for the Code Walkthrough VS Code extension in this repo. The output is a single walkthrough document that points at real files and line ranges in the target workspace and is saved under the workspace's `.walkthroughs/` folder.

This skill is only about producing a valid walkthrough YAML file and validating it after it has been written. It does not decide the walkthrough's pedagogical style, number of steps, number of files, or level of explanation detail beyond what is required for schema validity.

The contract is strict. Invalid keys, bad paths, or incorrect line numbers make the walkthrough fail. Treat `walkthrough.schema.json` in the repo root as authoritative and use it to verify the final YAML shape.

## Quick start

- Produce exactly one YAML document.
- Output YAML only, with no prose before or after it.
- Use only the fields in the schema below.
- Save the walkthrough file under `.walkthroughs/`.
- Double-check every `file`, `range.start`, and `range.end` against the actual repo before finalizing.
- When shell access is available, validation is mandatory after writing the walkthrough file.

## Scope

- This skill covers how to build a valid walkthrough YAML file.
- This skill does not define the ideal number of steps, number of files, explanation depth, teaching voice, or which concepts deserve the most emphasis.
- Those content decisions should come from the user or from another skill or instruction that defines the walkthrough's purpose and level of specificity.
- The main content-bearing field is `explanation`, but what it should emphasize is intentionally left to higher-level instructions.

## Source of truth

- Primary contract: `walkthrough.schema.json`
- Target files: `.walkthroughs/*.yaml` and `.walkthroughs/*.yml`
- If the schema and a loose instruction ever conflict, follow the schema.
- Validation command: `npm run validate:walkthrough -- <path-to-walkthrough-file>`

## Schema

Top-level fields:

- `title` - required, string, `minLength: 1`, `maxLength: 120`
- `description` - optional, string, `minLength: 1`, `maxLength: 200`
- `steps` - required, array with at least 1 step

Each step must contain exactly:

- `title` - required, non-empty string
- `file` - required, repo-relative path string that must not start with `/`, `./`, `../`, or a Windows drive prefix
- `range` - required object with:
  - `start` - required integer, 1-indexed
  - `end` - required integer, 1-indexed
- `explanation` - required, non-empty markdown string

The schema also enforces `additionalProperties: false` at the top level, on each step, and on `range`. That means no extra keys anywhere.

## Hard constraints

- `file` must be relative to the repo root. Never use absolute paths.
- Do not use `./foo.ts`, `../foo.ts`, or `C:\foo.ts`.
- Use `range.start` and `range.end`. Never use `range: [start, end]`.
- `explanation` must be a single markdown string. Use YAML `|` for multiline text when needed.
- Do not output comments, metadata, IDs, tags, summaries, or extra keys.
- Keep the walkthrough title and step titles short.
- Omit `description` when it does not add value.
- The walkthrough file itself must be saved inside `.walkthroughs/`.
- Every referenced file and line range must exist in the target repo.
- `range.start` and `range.end` must point to real lines in the referenced file.
- `range.end` must not be earlier than `range.start`, even though that semantic check is stricter than the current JSON schema.
- Never guess line numbers. Inspect the file and verify them.

## Workflow

1. Determine the walkthrough content requirements from the user or from other active skills or instructions.
2. Inspect the actual files and collect exact repo-relative paths and exact 1-indexed line ranges.
3. Build the walkthrough YAML so it satisfies the schema in this skill.
4. Save the new walkthrough to a file under `.walkthroughs/*.yaml` or `.walkthroughs/*.yml`.
5. Run `npm run validate:walkthrough -- <path-to-walkthrough-file>`.
6. If validation fails, fix the file and rerun the validator until it passes.
7. After the validator passes, do a final manual spot-check of file paths and line ranges against the source files.

## Validation checklist

- The response is exactly one YAML document.
- The response contains no code fences and no surrounding prose.
- Top-level keys are only `title`, optional `description`, and `steps`.
- Every step has only `title`, `file`, `range`, and `explanation`.
- The walkthrough file path is under `.walkthroughs/`.
- Every `file` value is repo-relative and matches a real file.
- Every `range.start` and `range.end` is a real 1-indexed line number in that file.
- Every `range` covers the intended code and is not inverted.
- The YAML would satisfy `walkthrough.schema.json`.
- If shell access is available, `npm run validate:walkthrough -- <path>` passes with no errors.

## Quality bar

- Favor structural correctness first.
- Keep `explanation` tied to the referenced code and valid markdown.
- Let other instructions decide the right level of specificity, number of steps, and teaching depth.
- A small, correct walkthrough is better than a larger one with a single bad path or line number.

## Canonical example

title: How the auth flow works
description: A tour of the token validation pipeline.
steps:
  - title: Entry point
    file: demo/src/auth.ts
    range:
      start: 43
      end: 58
    explanation: |
      The request first hits `validateToken`, which pulls the
      bearer token off the `Authorization` header.

  - title: Signature check
    file: demo/src/auth.ts
    range:
      start: 51
      end: 58
    explanation: |
      The bearer token is normalized and looked up in the
      in-memory token table before the authenticated user is returned.

## Another valid example

title: Request lifecycle
steps:
  - title: Request enters middleware
    file: demo/src/middleware.ts
    range:
      start: 15
      end: 21
    explanation: |
      `attachUser` validates the token and returns a new request
      context with the authenticated user attached.

  - title: Route dispatch
    file: demo/src/routes.ts
    range:
      start: 83
      end: 112
    explanation: |
      `routeRequest` normalizes the path, checks each matcher,
      and dispatches to the first handler that matches.

## Schema reference

Use this schema as the exact contract:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/walkthrough.schema.json",
  "title": "Code Walkthrough",
  "description": "Schema for YAML-authored code walkthrough files.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "title",
    "steps"
  ],
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 120
    },
    "description": {
      "type": "string",
      "minLength": 1,
      "maxLength": 200
    },
    "steps": {
      "type": "array",
      "minItems": 1,
      "items": {
        "$ref": "#/$defs/step"
      }
    }
  },
  "$defs": {
    "nonEmptyString": {
      "type": "string",
      "minLength": 1
    },
    "relativePath": {
      "type": "string",
      "minLength": 1,
      "pattern": "^(?!/)(?!\\./)(?!\\.\\./)(?![A-Za-z]:[\\\\/]).+"
    },
    "lineRange": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "start",
        "end"
      ],
      "properties": {
        "start": {
          "type": "integer",
          "minimum": 1
        },
        "end": {
          "type": "integer",
          "minimum": 1
        }
      }
    },
    "step": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "title",
        "file",
        "range",
        "explanation"
      ],
      "properties": {
        "title": {
          "$ref": "#/$defs/nonEmptyString"
        },
        "file": {
          "$ref": "#/$defs/relativePath"
        },
        "range": {
          "$ref": "#/$defs/lineRange"
        },
        "explanation": {
          "$ref": "#/$defs/nonEmptyString"
        }
      }
    }
  }
}
```

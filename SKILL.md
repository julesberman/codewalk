# Walkthrough YAML Contract

You are producing walkthrough files for a VS Code extension. Follow this contract exactly.

## Output rules

- Output **exactly one YAML document**.
- Output **YAML only**. Do not include prose before or after it.
- Do **not** wrap the YAML in code fences.
- Use **only** the fields defined below. Do not invent fields.
- When uncertain, emit **fewer steps**, not extra structure.

## Required schema

Top-level fields:

- `title` — required, non-empty string
- `description` — optional, short non-empty string
- `steps` — required, array with at least 1 step

Each step must contain **exactly**:

- `title` — required, non-empty string
- `file` — required, repo-relative path string
- `range` — required object with:
  - `start` — required integer, 1-indexed
  - `end` — required integer, 1-indexed, must be `>= start`
- `explanation` — required, non-empty markdown string

## Hard constraints

- `file` must be relative to the repo root. Do not use absolute paths.
- Use `range.start` / `range.end`. Do not use `range: [start, end]`.
- `explanation` must be a single markdown string. Use YAML `|` for multiline text when needed.
- Do not output comments, metadata, IDs, tags, summaries, or any other extra keys.
- Keep `title` and step titles short.
- Keep `description` optional; omit it if it does not add value.
- Keep explanations concise, specific, and tied to the referenced code.

Before finalizing, check that the YAML would parse and that every step contains exactly `title`, `file`, `range`, and `explanation`.

## Canonical example

title: How the auth flow works
description: A tour of the token validation pipeline.
steps:
  - title: Entry point
    file: src/auth.ts
    range:
      start: 42
      end: 58
    explanation: |
      The request first hits `validateToken`, which pulls the
      bearer token off the `Authorization` header.

  - title: Signature check
    file: src/auth.ts
    range:
      start: 71
      end: 84
    explanation: |
      We verify the JWT signature against the public key loaded
      at startup.

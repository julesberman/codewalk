# PLAN.md

## Project: Code Walkthrough (VS Code Extension)

A minimal VS Code extension that plays back **code walkthroughs** authored as YAML files. An LLM (or a human) produces a walkthrough file describing a sequence of code locations with explanatory comments; the extension renders a clean, stepped tour through those locations inside the editor.

## The Goal

When an agent like Claude Code writes or modifies code, users often want a guided tour of what just happened — but today that explanation lives in a chat pane, divorced from the editor. This extension closes that gap with the smallest possible surface area: **a file format, a player, and a sidebar.** Nothing more.

The entire project succeeds or fails on **UI/UX clarity**. Every design decision should be evaluated against a single question: *does this make the walkthrough feel effortless to follow?* If a feature doesn't serve that, it doesn't ship.

## Non-Goals

This extension does **not**:

- Generate walkthroughs. That is the LLM's job. The extension only consumes files.
- Run servers, daemons, or background processes.
- Include TTS, audio, video, or any media beyond text and code highlighting.
- Orchestrate sub-agents, plan features, or talk to any API.
- Track progress, sync across machines, or persist state beyond the open file.
- Support authoring UIs. Walkthroughs are edited as YAML in the editor like any other file.
- Add custom keybinding settings. Users can rebind commands through VS Code's normal keybinding UI.

Feature creep is the enemy. When in doubt, leave it out.

## Core Experience

A user opens a repo containing a `.walkthroughs/` folder. The extension's sidebar lists every walkthrough found there. Clicking one starts playback:

1. The relevant file opens in the main editor.
2. The target line range is highlighted with a **subtle background tint**. The rest of the file may be **softly dimmed** only if the effect remains legible, theme-native, and clearly secondary to the highlight.
3. A **persistent sidebar panel** renders the current step's explanation as markdown.
4. The user advances with **keyboard shortcuts, clickable next/prev buttons, or by clicking any step in the step list** to jump directly.
5. When the walkthrough ends, or the user exits, decorations clear and the editor returns to normal.

That's the whole product.

## Workspace Scope

For v1, multi-root workspaces are out of scope. The extension operates on the first workspace folder only. Walkthrough files live at `.walkthroughs/*.yaml` under that workspace root, and each `file` path in a step resolves relative to that same root.

## File Format

Walkthroughs are YAML. YAML was chosen for readability — both humans and LLMs write it comfortably, and multi-line explanations stay clean without escaping.

The schema should be optimized for **easy emission by LLMs** and **strict validation by the extension**:

- Keep the field set frozen and small.
- Use self-describing objects rather than positional tuples.
- Forbid unknown fields everywhere.
- Keep `description` optional.
- Treat `explanation` as a single markdown string, not a nested structure.

Location: `.walkthroughs/*.yaml` at the workspace root. Auto-discovered and listed in the sidebar.

Minimal schema:

```yaml
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
      bearer token off the `Authorization` header. Note that we
      lowercase the header name — Express normalizes it, but
      other frameworks don't.

  - title: Signature check
    file: src/auth.ts
    range:
      start: 71
      end: 84
    explanation: |
      We verify the JWT signature against the public key loaded
      at startup. A failure here throws before any downstream
      middleware runs.

  - title: Attaching the user
    file: src/middleware.ts
    range:
      start: 12
      end: 20
    explanation: |
      On success, the decoded claims get attached to `req.user`
      so route handlers can read them without re-parsing.
```

Fields:

- `title` (required) — shown in the sidebar list and as the walkthrough header.
- `description` (optional) — a short one-liner shown below the title in browse mode. Omit it when it does not add value.
- `steps` (required, ≥1) — ordered array.
  - `title` (required) — shown in the step list and as the step header.
  - `file` (required) — path relative to the workspace root.
  - `range` (required) — object with `start` and `end`, both 1-indexed and inclusive.
  - `explanation` (required) — markdown string. Multi-line via YAML `|` block scalar is preferred.

Keep the schema frozen. New fields invite feature creep; resist them.

## Validation

Validation happens in three layers:

1. **LLM contract**: a `SKILL.md` file instructs agents to emit exactly one YAML document matching the frozen schema, with no extra prose and no extra fields.
2. **Editor-time validation**: `.walkthroughs/*.yaml` should be associated with `walkthrough.schema.json` so malformed files get immediate feedback while being edited.
3. **Runtime validation**: the extension parses YAML, validates it against `walkthrough.schema.json`, then performs a small set of semantic checks before playback starts.

Runtime semantic checks must include at least:

- YAML parse failure
- missing required fields
- unknown fields
- empty `steps`
- empty or whitespace-only `title`, `description`, or `explanation`
- `range.start < 1` or `range.end < 1`
- `range.end < range.start`
- referenced file does not exist
- referenced range exceeds the file's line count

Malformed walkthroughs must fail loudly and helpfully in the sidebar. Never partially start playback for an invalid walkthrough.

## UI Specification

### Sidebar (webview)

A single persistent view in the Activity Bar with its own icon. It has two modes:

**Browse mode** (no walkthrough active): a list of discovered walkthroughs, each showing title and description when present. Click to start.

**Playback mode** (walkthrough active):

- Header: walkthrough title, a close/exit button.
- A vertical step list showing every step's title, with the current step highlighted. Any step is clickable to jump directly.
- Below the list: the current step's title as a heading, its explanation rendered as markdown.
- Footer: prev / next buttons and a `3 / 12` step counter.

The sidebar is the only UI surface. No status bar clutter, no popups, no notifications during playback.

### Editor decorations

When a step activates:

- The target file opens (or focuses if already open) and scrolls the range into view.
- The target range gets a subtle background tint — use a theme-aware color (`editor.wordHighlightBackground` or similar) so it works in light and dark themes.
- Non-active lines may receive a very soft dim/fade decoration only when the effect preserves readability and feels native to the current theme. Highlighting the active range is mandatory; dimming is optional.
- When the walkthrough ends, the user exits, a new walkthrough starts, or the extension deactivates, all decorations clear immediately.

Decorations must never persist across walkthrough exits or extension reloads.

### Navigation

Three mechanisms, all always available:

1. **Keyboard**: `Alt+]` / `Alt+[` for next/prev. `Esc` exits.
2. **Buttons**: Prev/Next in the sidebar footer.
3. **Step list**: Click any step title in the sidebar to jump to it.

The extension contributes commands and default keybindings only. It does not expose custom keybinding settings.

## State and Cleanup

Playback is strictly single-session:

- Only one walkthrough may be active at a time.
- Starting a new walkthrough first disposes the prior session completely.
- Exiting playback clears decorations, step state, and any transient UI state immediately.
- Extension deactivation or reload must leave the editor in a pristine state.

There is no persisted playback state.

## Architecture

Keep it boring. One extension, no external processes.

```
src/
  extension.ts         # activate/deactivate, command registration
  walkthroughLoader.ts # scan .walkthroughs/, parse YAML, validate, semantic checks
  player.ts            # current walkthrough state, step navigation, session cleanup
  decorations.ts       # highlight + optional dim logic using TextEditorDecorationType
  sidebarView.ts       # WebviewViewProvider for the sidebar
  walkthrough.schema.json
  media/
    sidebar.html       # webview markup
    sidebar.css        # minimal, theme-aware styles
    sidebar.js         # message passing to the extension host
SKILL.md               # strict agent contract for generating walkthrough YAML
```

Dependencies:

- `js-yaml` for parsing YAML.
- `ajv` for validating parsed walkthrough objects against `walkthrough.schema.json`.

That's it. No frameworks in the webview — plain HTML/CSS/JS. The webview should feel like VS Code's own UI; use `var(--vscode-*)` CSS variables for all colors and fonts.

## Design Principles

1. **Clarity over cleverness.** If a user has to read docs to understand the UI, the UI has failed.
2. **Theme-native.** Every color, font, and spacing value comes from VS Code's CSS variables. The extension should be invisible as a "third-party thing" — it should feel built-in.
3. **Nothing persistent.** No settings files, no cached state, no telemetry. The walkthrough YAML is the entire source of truth.
4. **Fail loudly and helpfully.** A malformed YAML file should produce a clear error in the sidebar, not a silent failure or a cryptic stack trace.
5. **Small surface area.** The extension should expose the minimum number of commands, settings, and contribution points needed. Every addition is debt.
6. **Strict input, forgiving presentation.** Be strict about schema and validation, but keep the playback UI calm and simple.

## What "Done" Looks Like

The v1 is complete when a user can:

1. Drop a `.walkthroughs/tour.yaml` into their repo.
2. Click the extension's sidebar icon.
3. See the walkthrough listed.
4. Click it and immediately be inside a clean, highlighted tour.
5. Step through with keyboard, buttons, or direct jumps.
6. Exit and have the editor return to a pristine state.
7. See a precise validation error instead of broken playback when a walkthrough file is malformed.

No configuration. No setup. No documentation needed beyond a README showing the YAML schema and a minimal example.

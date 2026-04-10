# Code Walkthrough

A minimal VS Code extension that plays YAML-authored code walkthroughs from `.walkthroughs/*.yaml`.

The extension adds a sidebar view that lists discovered walkthroughs, opens the referenced files, highlights the active line range, and lets you move through steps with buttons, direct step clicks, or keyboard shortcuts.

## What is in this repo

- `src/` contains the extension host code.
- `media/` contains the sidebar webview HTML, CSS, JS, and icon assets.
- `demo/` is a ready-to-open sample workspace with code and walkthrough files.
- `walkthrough.schema.json` is the frozen walkthrough schema used for validation.
- `SKILL.md` documents the YAML contract for LLM-authored walkthrough files.
- `test/` contains the loader tests and extension smoke test harness.

## Requirements

- Node.js and npm
- VS Code

This project currently targets the VS Code extension host via TypeScript and compiles to `out/`.

## Install dependencies

From the repo root:

```bash
npm install
```

## Build the extension

Compile the TypeScript sources once:

```bash
npm run compile
```

For an active development loop:

```bash
npm run watch
```

That now does three things:

- runs an initial compile
- keeps the `out/` directory updated while you edit files
- opens a new VS Code window on `demo/` with this repo loaded as the extension under development

If you only want the plain TypeScript watcher without launching VS Code:

```bash
npm run watch:tsc
```

## Run the extension in development

1. Open this repo in VS Code.
2. Run `npm install` if you have not already.
3. Run `npm run watch`.

That command will compile the extension, start watch mode, and open `demo/` in a new VS Code window with this extension loaded.

`F5` still works if you want the debugger attached instead of the terminal-driven flow.

This repo now includes [.vscode/launch.json](/Users/julesberman/sc/walkthrough/.vscode/launch.json) and [.vscode/tasks.json](/Users/julesberman/sc/walkthrough/.vscode/tasks.json), so `F5` should run the correct extension debug configuration instead of asking you to pick a debugger.

If you want to start it manually instead of using `npm run watch`:

1. Open the Run and Debug panel in VS Code.
2. Choose `Run Extension`.
3. Click the green play button.

What `npm run watch` does here:

- runs `npm run compile`
- starts `tsc --watch`
- launches VS Code on `demo/`
- loads this repo as an extension using `--extensionDevelopmentPath`

What `F5` does here:

- runs the `npm: compile` pre-launch task
- starts a new VS Code window called the Extension Development Host
- loads this repo as an extension using `--extensionDevelopmentPath=${workspaceFolder}`

The two windows have different roles:

- the original window is where you edit this extension's source code
- the Extension Development Host window is where you test the extension as a user

If you change source code while developing:

- run `npm run compile` again, or
- keep `npm run watch` running in a terminal

Then restart the debug session to pick up the rebuilt output in `out/`.

## Try the extension locally

Inside the Extension Development Host window:

1. Open the folder `demo/` from this repo as the workspace.
2. Click the Walkthrough icon in the Activity Bar.
3. Start with `Auth flow overview`, `Request lifecycle`, `Project creation flow`, or `Incident response flow`.
4. Use `Alt+]`, `Alt+[`, or the sidebar buttons to move through the steps.

The demo workspace already contains:

- sample code in [demo/src/auth.ts](/Users/julesberman/sc/walkthrough/demo/src/auth.ts), [demo/src/middleware.ts](/Users/julesberman/sc/walkthrough/demo/src/middleware.ts), [demo/src/routes.ts](/Users/julesberman/sc/walkthrough/demo/src/routes.ts), [demo/src/projects.ts](/Users/julesberman/sc/walkthrough/demo/src/projects.ts), and [demo/src/audit.ts](/Users/julesberman/sc/walkthrough/demo/src/audit.ts)
- walkthrough files in [demo/.walkthroughs/auth-flow.yaml](/Users/julesberman/sc/walkthrough/demo/.walkthroughs/auth-flow.yaml), [demo/.walkthroughs/request-lifecycle.yaml](/Users/julesberman/sc/walkthrough/demo/.walkthroughs/request-lifecycle.yaml), [demo/.walkthroughs/project-creation.yaml](/Users/julesberman/sc/walkthrough/demo/.walkthroughs/project-creation.yaml), and [demo/.walkthroughs/incident-response.yaml](/Users/julesberman/sc/walkthrough/demo/.walkthroughs/incident-response.yaml)

If you want the exact click path:

1. Run `npm run watch` from the repo root.
2. Wait for the new VS Code window to open on [demo](/Users/julesberman/sc/walkthrough/demo).
3. Click the Walkthrough Activity Bar icon.
4. Click one of the listed walkthroughs.

Example walkthrough:

```yaml
title: Sample walkthrough
description: A quick tour through one file.
steps:
  - title: First step
    file: src/example.ts
    range:
      start: 1
      end: 4
    explanation: |
      This step explains the first block of code.
```

## Commands and keybindings

Commands contributed by the extension:

- `Walkthrough: Start`
- `Walkthrough: Next Step`
- `Walkthrough: Previous Step`
- `Walkthrough: Exit`

Default keybindings during playback:

- `Alt+]` moves to the next step
- `Alt+[` moves to the previous step
- `Esc` exits the walkthrough

You can also use the sidebar footer buttons and click any step in the step list to jump directly.

## Validation behavior

Walkthrough files are validated in three ways:

- Editor-time validation via the YAML schema contribution for `.walkthroughs/*.yaml` and `.walkthroughs/*.yml`
- Runtime schema validation using `ajv`
- Runtime YAML parsing using `js-yaml` plus semantic checks such as missing files or invalid line ranges

The extension depends on `redhat.vscode-yaml` for the best editor-time schema experience.

## Run tests

Run the automated test suite with:

```bash
npm test
```

This does two things:

- compiles the project
- launches the VS Code extension test runner and executes the loader tests plus a basic extension smoke test

The test command was run successfully in this repo during implementation.

If you only want a typecheck-style pass without launching the extension tests:

```bash
npm run lint
```

## Packaging notes

This repo is set up as a normal VS Code extension project with:

- `package.json` extension contributions
- compiled output in `out/`
- `.vscodeignore` for packaging exclusions

If you want to package or publish it later, the next likely step is adding a packaging tool such as `vsce`. That is not wired into the current scripts yet.

## Current behavior and scope

- Only the first workspace folder is used.
- Walkthroughs are discovered from `.walkthroughs/*.yaml` and `.walkthroughs/*.yml`.
- Only one walkthrough can be active at a time.
- The sidebar is the main UI surface.
- Playback state is not persisted.

## Troubleshooting

If the sidebar is empty:

- make sure you opened a folder workspace, not just a single file
- make sure `.walkthroughs/` exists at the workspace root
- make sure your walkthrough file ends in `.yaml` or `.yml`
- if you are trying the built-in demo, make sure you opened `demo/` itself as the workspace, not the extension repo root

If a walkthrough fails to start:

- check the sidebar error message
- verify the YAML matches `walkthrough.schema.json`
- verify each `file` path is relative to the workspace root
- verify `range.start` and `range.end` point to real lines in the target file

If code changes do not appear in the Extension Development Host:

- rerun `npm run compile`, or
- keep `npm run watch` running while developing

If `npm run watch` does not open VS Code:

- make sure the `code` shell command is installed, or
- set `VSCODE_BIN` to your VS Code CLI path before running the command

## Relevant files

- [package.json](/Users/julesberman/sc/walkthrough/package.json)
- [demo](/Users/julesberman/sc/walkthrough/demo)
- [src/extension.ts](/Users/julesberman/sc/walkthrough/src/extension.ts)
- [src/walkthroughLoader.ts](/Users/julesberman/sc/walkthrough/src/walkthroughLoader.ts)
- [walkthrough.schema.json](/Users/julesberman/sc/walkthrough/walkthrough.schema.json)
- [SKILL.md](/Users/julesberman/sc/walkthrough/SKILL.md)

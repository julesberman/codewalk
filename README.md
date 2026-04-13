# Code Walkthrough

Code Walkthrough is a VS Code extension that plays YAML-authored code walkthroughs from a workspace `.walkthroughs/` folder. It lists available walkthroughs in a sidebar, opens the referenced files, highlights the active range, and lets you step through the explanation in order.

## How To Use It

The intended authoring flow is:

1. Ask your agent to generate a walkthrough using the `codewalk-yaml-contract` skill.
2. Save the generated YAML to `<repo>/.walkthroughs/<name>.yaml`.
3. Open that repo in VS Code with Code Walkthrough installed.
4. Open the Code Walkthrough sidebar and start the walkthrough.

The extension discovers `.yaml` and `.yml` files in the workspace-root `.walkthroughs/` folder by default.

## Author A Walkthrough With An Agent

Use the skill at `dev/codewalk-yaml-contract/SKILL.md` as the authoring contract. That skill is the source of truth for:

- the allowed YAML shape
- required fields
- repo-relative file paths
- exact 1-indexed line ranges
- validation expectations

The schema is strict. Extra keys, missing files, or wrong line ranges will make the walkthrough fail validation or fail to start.

## Minimal Example

Save this as `.walkthroughs/example.yaml` in the repo you want to explain:

```yaml
title: Request flow
description: A short walkthrough of the request entry point.
steps:
  - title: Entry point
    file: src/routes.ts
    range:
      start: 10
      end: 18
    explanation: |
      This is where the request first enters the route handler.
```

## Start A Walkthrough

After the walkthrough file exists:

1. Open the target repo as a folder workspace in VS Code.
2. Open the Code Walkthrough view from the Activity Bar.
3. Click a walkthrough from the list.
4. Move through steps with the sidebar controls or keyboard shortcuts.

Default navigation:

- `Alt+]` moves to the next step
- `Alt+[` moves to the previous step
- `Esc` exits the current walkthrough

You can also click any step in the sidebar to jump directly to it.

## Validation And Limits

Walkthrough files are validated in three ways:

- YAML schema validation for `.walkthroughs/*.yaml` and `.walkthroughs/*.yml`
- runtime schema validation with `ajv`
- runtime semantic checks for real files and real line ranges

Notes:

- only the first workspace folder is used
- the walkthrough folder defaults to `.walkthroughs`
- the extension depends on `redhat.vscode-yaml` for the best schema validation experience in the editor
- only one walkthrough can be active at a time
- playback state is not persisted

If the sidebar is empty:

- make sure you opened a folder workspace, not a single file
- make sure the repo has a `.walkthroughs/` folder at the workspace root
- make sure the walkthrough file ends in `.yaml` or `.yml`

If a walkthrough fails to start:

- verify the YAML matches `walkthrough.schema.json`
- verify each `file` path is repo-relative
- verify `range.start` and `range.end` point to real lines in the target file

## Local Development

```bash
npm install
npm run watch
```

That compiles the extension, watches for changes, and opens VS Code on the bundled `dev/demo/` workspace with this extension loaded for development.

This repo does not rely on checked-in `.vscode/` workspace settings. Use the npm scripts directly instead of VS Code task or launch configs.

If you only want to compile once:

```bash
npm run compile
```

If you only want a typecheck-style pass:

```bash
npm run lint
```

## Install From GitHub

This extension is currently distributed directly as a `.vsix` file from GitHub. Marketplace publishing is intentionally deferred.

Quick install on macOS or Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/julesberman/codewalk/main/dev/install-extension.sh | bash
```

If VS Code is already open when the install finishes, run `Developer: Reload Window` before opening the CodeWalk sidebar. A reload badge on the Extensions view or a sidebar that stays on a loading bar means the window has not reloaded yet.

The installer:

- downloads the latest hosted `.vsix`
- validates that the archive contains the compiled extension entrypoint and runtime dependencies before installation
- installs it with the VS Code `code` CLI
- verifies that VS Code extracted the expected runtime files after installation
- optionally installs the `codewalk-yaml-contract` skill file
- offers common Codex and Claude Code skill directories, plus a custom path

Prerequisites:

- `bash`
- `curl`
- `zipinfo`
- the VS Code `code` CLI on your `PATH`

If you do not have the `code` CLI available, install the extension manually:

1. Download [downloads/code-walkthrough.vsix](downloads/code-walkthrough.vsix).
2. In VS Code, open the Command Palette.
3. Run `Extensions: Install from VSIX...`
4. Select the downloaded `.vsix` file.
5. Run `Developer: Reload Window` if VS Code does not reload automatically.

You can also install the tracked VSIX from a local clone:

```bash
bash dev/install-extension.sh
```

If you want to install a VSIX you built from your local source instead of the tracked `downloads/code-walkthrough.vsix`, package it first and then install that file:

```bash
npm install
npm run package:vsix
code --install-extension ./code-walkthrough-0.1.0.vsix
```

Then reload the current VS Code window.

## Build And Refresh The Hosted `.vsix`

Maintain the GitHub installer by updating the tracked `.vsix` in `downloads/code-walkthrough.vsix`.

Build and validate a fresh package with:

```bash
npm install
npm run lint
npm test
npm run package:vsix
```

Then refresh the hosted installer artifact:

```bash
cp ./code-walkthrough-<version>.vsix ./downloads/code-walkthrough.vsix
```

Before pushing, verify the generated local package and the tracked hosted package:

```bash
ls -1 ./*.vsix ./downloads/code-walkthrough.vsix
```

The GitHub installer script always fetches:

```text
https://raw.githubusercontent.com/julesberman/codewalk/main/downloads/code-walkthrough.vsix
```

If you bump the extension version, build a new `.vsix`, replace `downloads/code-walkthrough.vsix`, and push both the source changes and the refreshed hosted package together.

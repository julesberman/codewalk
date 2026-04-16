import * as assert from "node:assert/strict";

import * as vscode from "vscode";

import { renderExplanationDocument } from "../../explanationPanel";
import { renderSidebarMarkup } from "../../sidebarMarkup";
import { parseSidebarMessage, type SidebarRenderState } from "../../sidebarView";
import { type PlaybackState, type Walkthrough } from "../../types";

describe("webview markup", () => {
  const walkthrough: Walkthrough = {
    fileName: "demo.yaml",
    relativePath: ".walkthroughs/demo.yaml",
    title: "Demo tour",
    description: "A short walkthrough",
    steps: [
      {
        title: "Intro",
        file: "src.ts",
        range: { start: 1, end: 2 },
        explanation: "A **bold** note\n- first\n- second",
      },
    ],
  };

  const playback: PlaybackState = {
    walkthrough,
    currentStepIndex: 0,
    explanationPanelVisible: false,
  };
  const iconUris = {
    settings: "settings.svg",
    edit: "edit.svg",
    trash: "trash.svg",
  };

  it("renders browse and playback sidebar markup with actionable controls", () => {
    const browseState: SidebarRenderState = {
      mode: "browse",
      walkthroughs: [walkthrough],
      playback: null,
      error: null,
      libraryLocation: ".walkthroughs",
    };

    const playbackState: SidebarRenderState = {
      ...browseState,
      mode: "playback",
      playback,
    };

    const browseMarkup = renderSidebarMarkup(browseState, iconUris);
    const playbackMarkup = renderSidebarMarkup(playbackState, iconUris);

    assert.match(browseMarkup, /data-action="startWalkthrough"/);
    assert.match(browseMarkup, /data-action="editWalkthrough"/);
    assert.match(playbackMarkup, /class="step-button is-active"/);
    assert.match(playbackMarkup, /<strong>bold<\/strong>/);
    assert.match(playbackMarkup, /<ul><li>first<\/li><li>second<\/li><\/ul>/);
  });

  it("renders explanation panel metadata and markdown without runtime markdown scripts", () => {
    const webview = createFakeWebview();
    const html = renderExplanationDocument(webview, vscode.Uri.file("/extension"), playback);

    assert.match(html, /Demo tour/);
    assert.match(html, /src\.ts · Lines 1-2/);
    assert.match(html, /<strong>bold<\/strong>/);
    assert.doesNotMatch(html, /markdown\.js/);
  });

  it("parses supported sidebar messages conservatively", () => {
    assert.deepEqual(parseSidebarMessage({ type: "next" }), { type: "next" });
    assert.deepEqual(
      parseSidebarMessage({ type: "jumpToStep", index: 2 }),
      { type: "jumpToStep", index: 2 },
    );
    assert.equal(parseSidebarMessage({ type: "jumpToStep", index: "2" }), null);
  });
});

function createFakeWebview(): vscode.Webview {
  return {
    cspSource: "https://example.test",
    asWebviewUri: (uri: vscode.Uri) => uri,
  } as vscode.Webview;
}

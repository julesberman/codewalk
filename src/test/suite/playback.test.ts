import * as assert from "node:assert/strict";

import {
  createPlaybackState,
  getAdjacentPlaybackIndex,
  withCurrentStepIndex,
  withExplanationPanelVisibility,
} from "../../player";
import { type Walkthrough } from "../../types";

describe("playback helpers", () => {
  const walkthrough: Walkthrough = {
    fileName: "demo.yaml",
    relativePath: ".walkthroughs/demo.yaml",
    title: "Demo",
    steps: [
      {
        title: "One",
        file: "src.ts",
        range: { start: 1, end: 1 },
        explanation: "first",
      },
      {
        title: "Two",
        file: "src.ts",
        range: { start: 2, end: 2 },
        explanation: "second",
      },
    ],
  };

  it("creates playback state at the first step", () => {
    const state = createPlaybackState(walkthrough);

    assert.equal(state.currentStepIndex, 0);
    assert.equal(state.walkthrough.title, "Demo");
  });

  it("calculates adjacent indexes without stepping outside bounds", () => {
    const state = createPlaybackState(walkthrough);
    const secondState = withCurrentStepIndex(state, 1);

    assert.equal(getAdjacentPlaybackIndex(state, -1), null);
    assert.equal(getAdjacentPlaybackIndex(state, 1), 1);
    assert.equal(getAdjacentPlaybackIndex(secondState ?? state, 1), null);
  });

  it("updates the current step and explanation panel visibility immutably", () => {
    const state = createPlaybackState(walkthrough);
    const moved = withCurrentStepIndex(state, 1);
    const visible = withExplanationPanelVisibility(state, true);

    assert.equal(moved?.currentStepIndex, 1);
    assert.equal(state.currentStepIndex, 0);
    assert.equal(visible.explanationPanelVisible, true);
    assert.equal(state.explanationPanelVisible, false);
  });
});

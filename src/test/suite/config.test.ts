import * as assert from "node:assert/strict";

import {
  coerceNumber,
  coerceWholeNumber,
  normalizeLibraryLocation,
  resolveTypographyPreset,
} from "../../config";

describe("config helpers", () => {
  it("normalizes library locations", () => {
    assert.equal(normalizeLibraryLocation("  /.walkthroughs/feature\\demo/ "), ".walkthroughs/feature/demo");
    assert.equal(normalizeLibraryLocation("   "), null);
  });

  it("coerces whole numbers with a minimum", () => {
    assert.equal(coerceWholeNumber(4.8, 1, 2), 4);
    assert.equal(coerceWholeNumber(-3, 1, 2), 2);
    assert.equal(coerceWholeNumber("nope", 5, 0), 5);
  });

  it("clamps bounded numbers", () => {
    assert.equal(coerceNumber(0.8, 0.5, 0, 1), 0.8);
    assert.equal(coerceNumber(4, 0.5, 0, 1), 1);
    assert.equal(coerceNumber(undefined, 0.5, 0, 1), 0.5);
  });

  it("resolves typography presets conservatively", () => {
    assert.equal(resolveTypographyPreset("system"), "system");
    assert.equal(resolveTypographyPreset("custom"), "monaspaceNeon");
  });
});

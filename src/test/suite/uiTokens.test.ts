import * as assert from "node:assert/strict";

import { getSharedUiTokenCss } from "../../uiTokens";

suite("UI tokens", () => {
  test("emits Monaspace font face and uses bundled preset by default", () => {
    const css = getSharedUiTokenCss({
      monaspaceNeonFontUri: "https://example.test/Monaspace-Neon.woff2",
    });

    assert.match(css, /@font-face/);
    assert.match(css, /font-family: "Monaspace Neon Var"/);
    assert.match(css, /src: url\("https:\/\/example\.test\/Monaspace-Neon\.woff2"\) format\("woff2"\)/);
    assert.match(css, /--font-family-body: "Monaspace Neon Var"/);
    assert.match(css, /--font-family-title: "Monaspace Neon Var"/);
    assert.match(css, /--font-family-mono: "Monaspace Neon Var"/);
    assert.match(css, /\.markdown pre \{/);
    assert.match(css, /\*, \*::before, \*::after \{/);
  });

  test("keeps existing stacks when system typography is selected", () => {
    const css = getSharedUiTokenCss({
      monaspaceNeonFontUri: "https://example.test/Monaspace-Neon.woff2",
      typographyPreset: "system",
    });

    assert.doesNotMatch(css, /--font-family-body: "Monaspace Neon Var"/);
    assert.match(css, /--font-family-body: var\(--vscode-font-family\)/);
    assert.match(css, /--font-family-title: "Iowan Old Style"/);
    assert.match(css, /--font-family-mono: var\(--vscode-editor-font-family\)/);
  });
});

import { renderMarkdownHtml } from "./markdown";
import { type PlaybackState, type WalkthroughErrorState, type WalkthroughSummary } from "./types";
import { escapeHtml } from "./webview";

import type { SidebarIconUris, SidebarRenderState } from "./sidebarView";

export function renderSidebarMarkup(state: SidebarRenderState, iconUris: SidebarIconUris): string {
  if (state.mode === "playback" && state.playback) {
    return wrapPanel(renderPlayback(state.playback));
  }

  if (state.mode === "error" && state.error) {
    return wrapPanel(renderErrorView(state.error));
  }

  return wrapPanel(renderBrowse(state.walkthroughs, state.libraryLocation, iconUris));
}

function wrapPanel(content: string): string {
  return `<div class="shell"><section class="panel">${content}</section></div>`;
}

function renderBrowse(
  walkthroughs: WalkthroughSummary[],
  libraryLocation: string,
  iconUris: SidebarIconUris,
): string {
  const header = `
    <div class="header-copy">
      <div class="browse-header-row">
        <div class="eyebrow browse-eyebrow">
          <span class="browse-eyebrow-label">CODEWALK LIBRARY</span>
        </div>
        ${renderIconButton("openSettings", "Settings", iconUris.settings)}
      </div>
      <button class="browse-path-button" type="button" data-action="openSettings">
        ${escapeHtml(libraryLocation.startsWith("/") ? libraryLocation : `/${libraryLocation}`)}
      </button>
    </div>`;

  if (walkthroughs.length === 0) {
    return `${header}
      <div class="empty">
        <div class="section-title">No walkthroughs found</div>
        <div class="body-copy muted">Add ${escapeHtml(libraryLocation)}/*.yaml under the workspace root to populate this list.</div>
      </div>`;
  }

  const items = walkthroughs.map((walkthrough) => {
    const titleClass = walkthrough.error ? "item-title item-title-broken" : "item-title";
    const copyClass = walkthrough.error ? "body-copy item-copy-broken" : "body-copy muted";
    const copy = walkthrough.error?.title ?? walkthrough.description ?? "Open this walkthrough to step through the flow.";
    const relativePath = walkthrough.relativePath;

    return `
      <article class="walkthrough-item">
        <div class="walkthrough-actions">
          ${renderIconButton("editWalkthrough", "Edit", iconUris.edit, relativePath)}
          ${renderIconButton("deleteWalkthrough", "Delete", iconUris.trash, relativePath, "is-danger")}
        </div>
        <button
          class="walkthrough-button"
          type="button"
          data-action="startWalkthrough"
          data-relative-path="${escapeAttribute(relativePath)}"
        >
          <div class="${titleClass}">${escapeHtml(walkthrough.title)}</div>
          <div class="${copyClass}">${escapeHtml(copy)}</div>
        </button>
      </article>`;
  }).join("");

  return `${header}<div class="walkthrough-list">${items}</div>`;
}

function renderPlayback(playback: PlaybackState): string {
  const { walkthrough, currentStepIndex, explanationPanelVisible } = playback;
  const step = walkthrough.steps[currentStepIndex];
  const stepButtons = walkthrough.steps.map((item, index) => `
      <button
        class="step-button${index === currentStepIndex ? " is-active" : ""}"
        type="button"
        data-action="jumpToStep"
        data-index="${index}"
        data-focus-id="step-${index}"
        data-tooltip="Step ${index + 1}: ${escapeAttribute(item.title)}"
      >
        <span class="step-index">${index + 1}.</span>
        <span class="step-title">${escapeHtml(item.title)}</span>
      </button>`).join("");

  const body = explanationPanelVisible
    ? `
      <div class="summary-block">
        <div class="section-label">Explanation Panel</div>
        <div class="section-title">${escapeHtml(step.title)}</div>
        <div class="item-meta">${escapeHtml(step.file)}</div>
        <div class="body-copy muted">Lines ${step.range.start}-${step.range.end} · Panel visible beside editor</div>
      </div>`
    : `
      <div class="explanation-block">
        <div class="section-title">${escapeHtml(step.title)}</div>
        <div class="markdown">${renderMarkdownHtml(step.explanation)}</div>
      </div>`;

  return `
    <div class="playback-topbar">
      <div class="playback-topbar-row">
        <button class="icon-button" type="button" data-action="exit" data-focus-id="playback-back" data-tooltip="Back">Back</button>
        <button
          class="icon-button is-panel-toggle${explanationPanelVisible ? " is-toggled" : ""}"
          type="button"
          data-action="toggleExplanationPanel"
          data-focus-id="playback-panel-toggle"
          data-tooltip="${explanationPanelVisible ? "Hide side panel" : "Show side panel"}"
          aria-label="${explanationPanelVisible ? "Hide side panel" : "Show side panel"}"
        >
          <span class="panel-toggle-icon" aria-hidden="true"></span>
          <span>Side Panel</span>
        </button>
      </div>
      <div class="header-copy">
        <div class="display-title">${escapeHtml(walkthrough.title)}</div>
        ${walkthrough.description ? `<div class="body-copy muted description-copy">${escapeHtml(walkthrough.description)}</div>` : ""}
      </div>
    </div>
    <div class="step-list${walkthrough.steps.length > 4 ? " is-scrollable" : ""}" data-focus-id="playback-panel" tabindex="-1">
      ${stepButtons}
    </div>
    ${body}
    <div class="footer">
      <button
        class="footer-button"
        type="button"
        data-action="previous"
        data-focus-id="playback-previous"
        data-tooltip="Previous step"
        ${currentStepIndex === 0 ? "disabled" : ""}
      >
        [ PREV
      </button>
      <div class="counter">${currentStepIndex + 1} / ${walkthrough.steps.length}</div>
      <button
        class="footer-button"
        type="button"
        data-action="next"
        data-focus-id="playback-next"
        data-tooltip="Next step"
        ${currentStepIndex === walkthrough.steps.length - 1 ? "disabled" : ""}
      >
        NEXT ]
      </button>
    </div>`;
}

function renderErrorView(error: WalkthroughErrorState): string {
  return `
    <div class="playback-topbar">
      <div class="playback-topbar-row">
        <button class="icon-button" type="button" data-action="exit" data-tooltip="Back">Back</button>
      </div>
      <div class="display-title error-title">${escapeHtml(error.fileName ?? "Walkthrough error")}</div>
    </div>
    <div class="error">
      <div class="section-label error-label">Error</div>
      <div class="section-title">${escapeHtml(error.title)}</div>
      ${error.fileName ? `<div class="item-meta">${escapeHtml(error.fileName)}</div>` : ""}
      <div class="body-copy">${escapeHtml(error.detail)}</div>
    </div>`;
}

function renderIconButton(
  action: string,
  label: string,
  iconUri: string,
  relativePath?: string,
  className = "",
): string {
  return `
    <button
      class="browse-icon-button${className ? ` ${className}` : ""}"
      type="button"
      data-action="${action}"
      ${relativePath ? `data-relative-path="${escapeAttribute(relativePath)}"` : ""}
      data-tooltip="${escapeAttribute(label)}"
      aria-label="${escapeAttribute(label)}"
    >
      <span class="browse-icon-button-icon" aria-hidden="true" style="--icon-url:url('${escapeAttribute(iconUri)}')"></span>
    </button>`;
}

function escapeAttribute(text: string): string {
  return escapeHtml(text).replaceAll("`", "&#96;");
}

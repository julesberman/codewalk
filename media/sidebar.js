(function () {
  const PLAYBACK_FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
  const vscode = acquireVsCodeApi();
  const app = document.getElementById("app");
  let activeState = null;
  let lastPlaybackFocusId = null;

  function postMessage(type, payload) {
    vscode.postMessage({ type, ...(payload ?? {}) });
  }

  postMessage("ready");

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || message.type !== "renderState" || !(app instanceof HTMLElement)) {
      return;
    }

    activeState = message.state;
    app.innerHTML = message.markup ?? "";
    syncStepListViewport(app);
    restorePlaybackFocus(app);
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-action]") : null;
    if (!(target instanceof HTMLElement) || target.hasAttribute("disabled")) {
      return;
    }

    const { action, relativePath, index } = target.dataset;
    switch (action) {
      case "startWalkthrough":
      case "editWalkthrough":
      case "deleteWalkthrough":
        if (relativePath) {
          postMessage(action, { relativePath });
        }
        return;
      case "jumpToStep":
        if (typeof index === "string") {
          postMessage("jumpToStep", { index: Number(index) });
        }
        return;
      case "openSettings":
      case "next":
      case "previous":
      case "toggleExplanationPanel":
      case "exit":
        postMessage(action);
        return;
      default:
        return;
    }
  });

  document.addEventListener("focusin", (event) => {
    if (activeState?.mode !== "playback") {
      return;
    }

    const focusTarget = event.target instanceof Element ? event.target.closest("[data-focus-id]") : null;
    if (focusTarget) {
      lastPlaybackFocusId = focusTarget.getAttribute("data-focus-id");
    }
  });

  window.addEventListener("keydown", (event) => {
    if (activeState?.mode !== "playback" || event.defaultPrevented) {
      return;
    }

    if (!event.metaKey && !event.ctrlKey && !event.altKey) {
      if (event.key === "Escape") {
        event.preventDefault();
        postMessage("exit");
        return;
      }

      if (event.key === "]") {
        event.preventDefault();
        lastPlaybackFocusId = "playback-panel";
        if (activeState.playback && activeState.playback.currentStepIndex < activeState.playback.stepCount - 1) {
          postMessage("next");
        }
        return;
      }

      if (event.key === "[") {
        event.preventDefault();
        lastPlaybackFocusId = "playback-panel";
        postMessage("previous");
        return;
      }
    }

    if (event.key === "Tab") {
      trapPlaybackTab(event);
    }
  });

  function syncStepListViewport(root) {
    const stepList = root.querySelector(".step-list");
    if (!(stepList instanceof HTMLElement)) {
      return;
    }

    if (!stepList.classList.contains("is-scrollable")) {
      stepList.style.removeProperty("max-height");
      stepList.scrollTop = 0;
      return;
    }

    const buttons = Array.from(stepList.querySelectorAll(".step-button"));
    const visibleButtons = buttons.slice(0, 4);
    const maxHeight = visibleButtons.reduce((height, button) => height + button.offsetHeight, 0);
    stepList.style.maxHeight = `${maxHeight}px`;

    const activeButton = stepList.querySelector(".step-button.is-active");
    if (activeButton instanceof HTMLElement) {
      requestAnimationFrame(() => {
        activeButton.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    }
  }

  function restorePlaybackFocus(root) {
    if (activeState?.mode !== "playback") {
      lastPlaybackFocusId = null;
      return;
    }

    const target =
      (lastPlaybackFocusId ? root.querySelector(`[data-focus-id="${lastPlaybackFocusId}"]`) : null) ??
      root.querySelector('[data-focus-id="playback-panel"]') ??
      root.querySelector('[data-focus-id="playback-next"]') ??
      root.querySelector(PLAYBACK_FOCUSABLE_SELECTOR);

    if (target instanceof HTMLElement) {
      requestAnimationFrame(() => {
        target.focus();
      });
    }
  }

  function trapPlaybackTab(event) {
    const playbackPanel = app?.querySelector(".panel");
    if (!(playbackPanel instanceof HTMLElement)) {
      return;
    }

    const focusable = Array.from(playbackPanel.querySelectorAll(PLAYBACK_FOCUSABLE_SELECTOR)).filter(
      (element) => element instanceof HTMLElement,
    );
    if (focusable.length === 0) {
      return;
    }

    const currentIndex = focusable.indexOf(document.activeElement);
    const nextIndex = event.shiftKey
      ? currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1
      : currentIndex === -1 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1;

    event.preventDefault();
    focusable[nextIndex].focus();
  }
})();

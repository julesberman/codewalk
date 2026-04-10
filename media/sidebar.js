(function () {
  const MAX_STEPS = 4;
  const PLAYBACK_FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
  const vscode = acquireVsCodeApi();
  const app = document.getElementById("app");
  let activeState = null;
  let lastPlaybackFocusId = null;

  function postMessage(type, payload = {}) {
    vscode.postMessage({ type, ...payload });
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || message.type !== "renderState") {
      return;
    }

    activeState = message.payload;
    render(message.payload);
  });

  document.addEventListener("focusin", (event) => {
    if (activeState?.mode !== "playback") {
      return;
    }

    const focusTarget = event.target instanceof Element ? event.target.closest("[data-focus-id]") : null;
    if (!focusTarget) {
      return;
    }

    lastPlaybackFocusId = focusTarget.getAttribute("data-focus-id");
  });

  window.addEventListener("keydown", (event) => {
    if (activeState?.mode !== "playback") {
      return;
    }

    if (event.defaultPrevented) {
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
        if (activeState.playback.currentStepIndex < activeState.playback.walkthrough.steps.length - 1) {
          postMessage("next");
        }
        return;
      }

      if (event.key === "[") {
        event.preventDefault();
        postMessage("previous");
        return;
      }
    }

    if (event.key === "Tab") {
      trapPlaybackTab(event);
    }
  });

  function render(state) {
    app.innerHTML = "";

    const shell = element("div", { className: "shell" });
    const stack = element("div", { className: "stack" });
    if (state.mode === "playback" && state.playback) {
      stack.appendChild(renderPlayback(state));
    } else if (state.mode === "error" && state.error) {
      stack.appendChild(renderErrorView(state.error));
    } else {
      stack.appendChild(renderBrowse(state.walkthroughs, state.libraryLocation));
    }

    shell.appendChild(stack);
    app.appendChild(shell);
    syncStepListViewport(shell);
    restorePlaybackFocus(shell, state);
  }

  function renderBrowse(walkthroughs, libraryLocation) {
    const panel = element("section", { className: "panel" });
    panel.appendChild(renderBrowseHeader(libraryLocation));

    if (walkthroughs.length === 0) {
      panel.appendChild(
        box("empty", [
          element("div", { className: "section-title", textContent: "No walkthroughs found" }),
          element("div", {
            className: "body-copy muted",
            textContent: `Add ${libraryLocation}/*.yaml under the workspace root to populate this list.`,
          }),
        ]),
      );
      return panel;
    }

    const list = element("div", { className: "walkthrough-list" });
    walkthroughs.forEach((walkthrough) => {
      const item = element("div", { className: "walkthrough-item" });
      const actions = element("div", { className: "walkthrough-actions" });

      const editButton = createWalkthroughActionButton({
        iconClassName: "walkthrough-action-icon-edit",
        label: "Edit",
        onClick: () => postMessage("editWalkthrough", { relativePath: walkthrough.relativePath }),
      });

      const deleteButton = createWalkthroughActionButton({
        buttonClassName: "is-danger",
        iconClassName: "walkthrough-action-icon-delete",
        label: "Delete",
        onClick: () => postMessage("deleteWalkthrough", { relativePath: walkthrough.relativePath }),
      });

      actions.appendChild(editButton);
      actions.appendChild(deleteButton);
      item.appendChild(actions);

      const button = element("button", {
        className: "walkthrough-button",
        type: "button",
      });
      button.addEventListener("click", () => postMessage("startWalkthrough", { relativePath: walkthrough.relativePath }));
      const title = element("div", {
        className: walkthrough.error ? "item-title item-title-broken" : "item-title",
        textContent: walkthrough.title,
      });
      const description = element("div", {
        className: walkthrough.error ? "body-copy item-copy-broken" : "body-copy muted",
        textContent: walkthrough.error?.title || walkthrough.description || "Open this walkthrough to step through the flow.",
      });
      button.appendChild(title);
      button.appendChild(description);

      item.appendChild(button);
      list.appendChild(item);
    });
    panel.appendChild(list);
    return panel;
  }

  function renderBrowseHeader(libraryLocation) {
    const wrapper = element("div", { className: "header-copy" });
    const eyebrow = element("div", { className: "eyebrow browse-eyebrow" });
    eyebrow.appendChild(
      element("span", {
        className: "browse-eyebrow-label",
        textContent: "CODEWALK LIBRARY",
      }),
    );
    eyebrow.appendChild(
      element("span", {
        className: "browse-eyebrow-path",
        textContent: libraryLocation.startsWith("/") ? libraryLocation : `/${libraryLocation}`,
      }),
    );
    wrapper.appendChild(eyebrow);
    return wrapper;
  }

  function createWalkthroughActionButton({ buttonClassName = "", iconClassName, label, onClick }) {
    const button = element("button", {
      className: ["walkthrough-action-button", buttonClassName].filter(Boolean).join(" "),
      type: "button",
    });
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.appendChild(
      element("span", {
        className: `walkthrough-action-icon ${iconClassName}`,
        ariaHidden: "true",
      }),
    );
    button.addEventListener("click", onClick);
    return button;
  }

  function renderPlayback(state) {
    const { walkthrough, currentStepIndex, explanationPanelVisible } = state.playback;
    const currentStep = walkthrough.steps[currentStepIndex];
    const isLastStep = currentStepIndex === walkthrough.steps.length - 1;
    const panel = element("section", { className: "panel" });

    const topbar = element("div", { className: "playback-topbar" });
    const topbarRow = element("div", { className: "playback-topbar-row" });
    const closeButton = element("button", {
      className: "icon-button",
      dataFocusId: "playback-back",
      type: "button",
      textContent: "Back",
    });
    closeButton.addEventListener("click", () => postMessage("exit"));
    const panelToggleButton = element("button", {
      className: explanationPanelVisible ? "icon-button is-panel-toggle is-toggled" : "icon-button is-panel-toggle",
      dataFocusId: "playback-panel-toggle",
      type: "button",
      ariaLabel: explanationPanelVisible ? "Hide side panel" : "Show side panel",
    });
    panelToggleButton.appendChild(
      element("span", {
        className: "panel-toggle-icon",
        ariaHidden: "true",
      }),
    );
    panelToggleButton.appendChild(
      element("span", {
        textContent: "Side Panel",
      }),
    );
    panelToggleButton.addEventListener("click", () => postMessage("toggleExplanationPanel"));

    const headerCopy = element("div", { className: "header-copy" });
    topbarRow.appendChild(closeButton);
    topbarRow.appendChild(panelToggleButton);
    headerCopy.appendChild(element("div", { className: "display-title", textContent: walkthrough.title }));
    if (walkthrough.description) {
      headerCopy.appendChild(
        element("div", {
          className: "body-copy muted description-copy",
          textContent: walkthrough.description,
        }),
      );
    }
    topbar.appendChild(topbarRow);
    topbar.appendChild(headerCopy);
    panel.appendChild(topbar);

    const stepList = element("div", {
      className: walkthrough.steps.length > MAX_STEPS ? "step-list is-scrollable" : "step-list",
    });
    walkthrough.steps.forEach((step, index) => {
      const button = element("button", {
        className: index === currentStepIndex ? "step-button is-active" : "step-button",
        dataFocusId: `step-${index}`,
        type: "button",
      });
      button.addEventListener("click", () => postMessage("jumpToStep", { index }));
      button.appendChild(
        element("span", {
          className: "step-index",
          textContent: `${index + 1}.`,
        }),
      );
      button.appendChild(
        element("span", {
          className: "step-title",
          textContent: step.title,
        }),
      );
      stepList.appendChild(button);
    });
    panel.appendChild(stepList);

    if (explanationPanelVisible) {
      panel.appendChild(
        box("summary-block", [
          element("div", { className: "section-label", textContent: "Explanation Panel" }),
          element("div", { className: "section-title", textContent: currentStep.title }),
          element("div", { className: "item-meta", textContent: currentStep.file }),
          element("div", {
            className: "body-copy muted",
            textContent: `Lines ${currentStep.range.start}-${currentStep.range.end} · Panel visible beside editor`,
          }),
        ]),
      );
    } else {
      const explanationCard = box("explanation-block", [
        element("div", { className: "section-title", textContent: currentStep.title }),
        renderMarkdown(currentStep.explanation),
      ]);
      panel.appendChild(explanationCard);
    }

    const footer = element("div", { className: "footer" });
    const previousButton = element("button", {
      className: "footer-button",
      dataFocusId: "playback-previous",
      type: "button",
      textContent: "[ PREV",
    });
    previousButton.disabled = currentStepIndex === 0;
    previousButton.addEventListener("click", () => postMessage("previous"));
    footer.appendChild(previousButton);

    footer.appendChild(
      element("div", {
        className: "counter",
        textContent: `${currentStepIndex + 1} / ${walkthrough.steps.length}`,
      }),
    );

    const nextButton = element("button", {
      className: "footer-button",
      dataFocusId: "playback-next",
      type: "button",
      textContent: "NEXT ]",
    });
    nextButton.disabled = isLastStep;
    nextButton.addEventListener("click", () => postMessage("next"));
    footer.appendChild(nextButton);

    panel.appendChild(footer);
    return panel;
  }

  function syncStepListViewport(root) {
    const stepList = root.querySelector(".step-list");
    if (!stepList) {
      return;
    }

    if (!stepList.classList.contains("is-scrollable")) {
      stepList.style.removeProperty("max-height");
      stepList.scrollTop = 0;
      return;
    }

    const buttons = Array.from(stepList.querySelectorAll(".step-button"));
    const visibleButtons = buttons.slice(0, MAX_STEPS);
    const maxHeight = visibleButtons.reduce((height, button) => height + button.offsetHeight, 0);
    stepList.style.maxHeight = `${maxHeight}px`;

    const activeButton = stepList.querySelector(".step-button.is-active");
    if (!activeButton) {
      return;
    }

    requestAnimationFrame(() => {
      activeButton.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  function restorePlaybackFocus(root, state) {
    if (state.mode !== "playback") {
      lastPlaybackFocusId = null;
      return;
    }

    const focusId = lastPlaybackFocusId ?? "playback-panel-toggle";
    const target =
      root.querySelector(`[data-focus-id="${focusId}"]`) ??
      root.querySelector('[data-focus-id="playback-next"]') ??
      root.querySelector(PLAYBACK_FOCUSABLE_SELECTOR);
    if (!(target instanceof HTMLElement)) {
      return;
    }

    requestAnimationFrame(() => {
      target.focus();
    });
  }

  function trapPlaybackTab(event) {
    const playbackPanel = app.querySelector(".panel");
    if (!playbackPanel) {
      return;
    }

    const focusableElements = Array.from(playbackPanel.querySelectorAll(PLAYBACK_FOCUSABLE_SELECTOR)).filter(
      (element) => element instanceof HTMLElement,
    );
    if (focusableElements.length === 0) {
      return;
    }

    const currentIndex = focusableElements.indexOf(document.activeElement);
    const nextIndex = event.shiftKey
      ? currentIndex <= 0
        ? focusableElements.length - 1
        : currentIndex - 1
      : currentIndex === -1 || currentIndex === focusableElements.length - 1
        ? 0
        : currentIndex + 1;

    event.preventDefault();
    focusableElements[nextIndex].focus();
  }

  function renderError(error) {
    return box("error", [
      element("div", { className: "section-label error-label", textContent: "Error" }),
      element("div", { className: "section-title", textContent: error.title }),
      error.fileName
        ? element("div", { className: "item-meta", textContent: error.fileName })
        : null,
      element("div", { className: "body-copy", textContent: error.detail }),
    ]);
  }

  function renderErrorView(error) {
    const panel = element("section", { className: "panel" });
    const topbar = element("div", { className: "playback-topbar" });
    const topbarRow = element("div", { className: "playback-topbar-row" });
    const closeButton = element("button", {
      className: "icon-button",
      type: "button",
      textContent: "Back",
    });
    closeButton.addEventListener("click", () => postMessage("exit"));

    topbarRow.appendChild(closeButton);
    topbar.appendChild(topbarRow);
    topbar.appendChild(
      element("div", {
        className: "display-title error-title",
        textContent: error.fileName ?? "Walkthrough error",
      }),
    );
    panel.appendChild(topbar);
    panel.appendChild(renderError(error));
    return panel;
  }

  function renderMarkdown(markdown) {
    const container = element("div", { className: "markdown" });
    window.WalkthroughMarkdown?.renderInto(container, markdown);
    return container;
  }

  function box(className, children) {
    const wrapper = element("div", { className });
    children.filter(Boolean).forEach((child) => wrapper.appendChild(child));
    return wrapper;
  }

  function element(tagName, options = {}) {
    const node = document.createElement(tagName);
    if (options.className) {
      node.className = options.className;
    }
    if (options.dataFocusId) {
      node.setAttribute("data-focus-id", options.dataFocusId);
    }
    if (options.textContent !== undefined) {
      node.textContent = options.textContent;
    }
    if (options.innerHTML !== undefined) {
      node.innerHTML = options.innerHTML;
    }
    if (options.type) {
      node.type = options.type;
    }
    if (options.ariaHidden !== undefined) {
      node.setAttribute("aria-hidden", options.ariaHidden);
    }
    return node;
  }
})();

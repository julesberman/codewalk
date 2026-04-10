(function () {
  const MAX_STEPS = 4;
  const PLAYBACK_FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
  const vscode = acquireVsCodeApi();
  const app = document.getElementById("app");
  let activeState = null;
  let lastPlaybackFocusId = null;

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
        vscode.postMessage({ type: "exit" });
        return;
      }

      if (event.key === "]") {
        event.preventDefault();
        if (activeState.playback.currentStepIndex < activeState.playback.walkthrough.steps.length - 1) {
          vscode.postMessage({ type: "next" });
        }
        return;
      }

      if (event.key === "[") {
        event.preventDefault();
        vscode.postMessage({ type: "previous" });
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
      stack.appendChild(renderBrowse(state.walkthroughs));
      stack.appendChild(renderError(state.error));
    } else {
      stack.appendChild(renderBrowse(state.walkthroughs));
    }

    shell.appendChild(stack);
    app.appendChild(shell);
    syncStepListViewport(shell);
    restorePlaybackFocus(shell, state);
  }

  function renderBrowse(walkthroughs) {
    const panel = element("section", { className: "panel" });
    panel.appendChild(renderHeader("", "", "Library"));

    if (walkthroughs.length === 0) {
      panel.appendChild(
        box("empty", [
          element("div", { className: "section-title", textContent: "No walkthroughs found" }),
          element("div", {
            className: "body-copy muted",
            textContent: "Add .walkthroughs/*.yaml under the workspace root to populate this list.",
          }),
        ]),
      );
      return panel;
    }

    const list = element("div", { className: "walkthrough-list" });
    walkthroughs.forEach((walkthrough) => {
      const button = element("button", {
        className: "walkthrough-button",
        type: "button",
      });
      button.addEventListener("click", () => {
        vscode.postMessage({
          type: "startWalkthrough",
          relativePath: walkthrough.relativePath,
        });
      });
      const title = element("div", { className: "item-title", textContent: walkthrough.title });
      const description = element("div", {
        className: "body-copy muted",
        textContent: walkthrough.description || "Open this walkthrough to step through the flow.",
      });
      button.appendChild(title);
      button.appendChild(description);
      list.appendChild(button);
    });
    panel.appendChild(list);
    return panel;
  }

  function renderPlayback(state) {
    const { walkthrough, currentStepIndex } = state.playback;
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
    closeButton.addEventListener("click", () => vscode.postMessage({ type: "exit" }));

    const headerCopy = element("div", { className: "header-copy" });
    topbarRow.appendChild(closeButton);
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
      button.addEventListener("click", () => vscode.postMessage({ type: "jumpToStep", index }));
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

    const explanationCard = box("explanation-block", [
      element("div", { className: "section-title", textContent: currentStep.title }),
      renderMarkdown(currentStep.explanation),
    ]);
    panel.appendChild(explanationCard);

    const footer = element("div", { className: "footer" });
    const previousButton = element("button", {
      className: "footer-button",
      dataFocusId: "playback-previous",
      type: "button",
      textContent: "[ PREV",
    });
    previousButton.disabled = currentStepIndex === 0;
    previousButton.addEventListener("click", () => vscode.postMessage({ type: "previous" }));
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
    nextButton.addEventListener("click", () => vscode.postMessage({ type: "next" }));
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

    const focusId = lastPlaybackFocusId ?? "playback-next";
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
      element("div", { className: "section-label", textContent: "Error" }),
      element("div", { className: "section-title", textContent: error.title }),
      error.fileName
        ? element("div", { className: "item-meta", textContent: error.fileName })
        : null,
      element("div", { className: "body-copy", textContent: error.detail }),
    ]);
  }

  function renderHeader(title, description, eyebrow) {
    const wrapper = element("div", { className: "header-copy" });
    if (eyebrow) {
      wrapper.appendChild(element("div", { className: "eyebrow", textContent: eyebrow }));
    }
    if (title) {
      wrapper.appendChild(element("div", { className: "display-title", textContent: title }));
    }
    if (description) {
      wrapper.appendChild(element("div", { className: "body-copy muted", textContent: description }));
    }
    return wrapper;
  }

  function section(title, child) {
    return box("section-block", [
      element("div", { className: "section-label", textContent: title }),
      child,
    ]);
  }

  function renderMarkdown(markdown) {
    const container = element("div", { className: "markdown" });
    tokenizeMarkdown(markdown).forEach((block) => {
      container.appendChild(block);
    });
    return container;
  }

  function tokenizeMarkdown(markdown) {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let paragraph = [];
    let listItems = [];
    let codeFence = null;

    const flushParagraph = () => {
      if (paragraph.length === 0) {
        return;
      }
      blocks.push(element("p", { innerHTML: renderInline(paragraph.join(" ")) }));
      paragraph = [];
    };

    const flushList = () => {
      if (listItems.length === 0) {
        return;
      }
      const list = element("ul");
      listItems.forEach((item) => {
        list.appendChild(element("li", { innerHTML: renderInline(item) }));
      });
      blocks.push(list);
      listItems = [];
    };

    for (const line of lines) {
      if (line.startsWith("```")) {
        flushParagraph();
        flushList();
        if (codeFence !== null) {
          blocks.push(renderCodeBlock(codeFence.join("\n")));
          codeFence = null;
        } else {
          codeFence = [];
        }
        continue;
      }

      if (codeFence !== null) {
        codeFence.push(line);
        continue;
      }

      const headingMatch = /^(#{1,4})\s+(.*)$/.exec(line);
      if (headingMatch) {
        flushParagraph();
        flushList();
        const level = String(Math.min(headingMatch[1].length, 4));
        blocks.push(element(`h${level}`, { innerHTML: renderInline(headingMatch[2]) }));
        continue;
      }

      const listMatch = /^[-*]\s+(.*)$/.exec(line);
      if (listMatch) {
        flushParagraph();
        listItems.push(listMatch[1]);
        continue;
      }

      if (line.trim().length === 0) {
        flushParagraph();
        flushList();
        continue;
      }

      paragraph.push(line.trim());
    }

    flushParagraph();
    flushList();
    if (codeFence !== null) {
      blocks.push(renderCodeBlock(codeFence.join("\n")));
    }

    return blocks.length > 0 ? blocks : [element("p", { textContent: markdown })];
  }

  function renderCodeBlock(code) {
    const pre = element("pre");
    pre.appendChild(element("code", { textContent: code }));
    return pre;
  }

  function renderInline(text) {
    let output = escapeHtml(text);
    output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
    output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      const safeHref = sanitizeHref(href);
      if (!safeHref) {
        return label;
      }

      return `<a href="${safeHref}">${label}</a>`;
    });
    return output;
  }

  function sanitizeHref(href) {
    if (/^(https?:|mailto:)/i.test(href)) {
      return href;
    }

    return null;
  }

  function escapeHtml(text) {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
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
    return node;
  }
})();

(function () {
  const vscode = acquireVsCodeApi();
  const app = document.getElementById("app");

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || message.type !== "renderState") {
      return;
    }

    render(message.payload);
  });

  function render(state) {
    app.innerHTML = "";

    const stack = element("div", { className: "stack" });
    if (state.mode === "playback" && state.playback) {
      stack.appendChild(renderPlayback(state));
    } else if (state.mode === "error" && state.error) {
      stack.appendChild(renderBrowse(state.walkthroughs));
      stack.appendChild(renderError(state.error));
    } else {
      stack.appendChild(renderBrowse(state.walkthroughs));
    }

    app.appendChild(stack);
  }

  function renderBrowse(walkthroughs) {
    const panel = element("section", { className: "panel" });
    panel.appendChild(renderHeader("Walkthroughs", "Open a YAML walkthrough from .walkthroughs/ to begin."));

    if (walkthroughs.length === 0) {
      panel.appendChild(
        box("empty", [
          element("div", { className: "title", textContent: "No walkthroughs found" }),
          element("div", {
            className: "muted",
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
      button.appendChild(element("div", { className: "title", textContent: walkthrough.title }));
      if (walkthrough.description) {
        button.appendChild(element("div", { className: "muted", textContent: walkthrough.description }));
      } else {
        button.appendChild(element("div", { className: "muted", textContent: walkthrough.relativePath }));
      }
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
    const closeButton = element("button", {
      className: "icon-button",
      type: "button",
      textContent: "Exit",
    });
    closeButton.addEventListener("click", () => vscode.postMessage({ type: "exit" }));
    topbar.appendChild(closeButton);

    const headerCopy = element("div", { className: "header-copy" });
    headerCopy.appendChild(element("div", { className: "title", textContent: walkthrough.title }));
    if (walkthrough.description) {
      headerCopy.appendChild(
        element("div", {
          className: "muted description-copy",
          textContent: walkthrough.description,
        }),
      );
    }
    topbar.appendChild(box("card header-card", [headerCopy]));
    panel.appendChild(topbar);

    const stepsCard = box("card", []);
    const stepList = element("div", { className: "step-list" });
    walkthrough.steps.forEach((step, index) => {
      const button = element("button", {
        className: index === currentStepIndex ? "step-button is-active" : "step-button",
        type: "button",
      });
      button.addEventListener("click", () => vscode.postMessage({ type: "jumpToStep", index }));
      button.appendChild(
        element("span", {
          className: "step-index",
          textContent: `${index + 1}.`,
        }),
      );
      button.appendChild(document.createTextNode(step.title));
      stepList.appendChild(button);
    });
    stepsCard.appendChild(stepList);
    panel.appendChild(stepsCard);

    const explanationCard = box("card explanation-card", [
      element("div", { className: "title", textContent: currentStep.title }),
      renderMarkdown(currentStep.explanation),
    ]);
    panel.appendChild(explanationCard);

    const footer = element("div", { className: "footer" });
    const previousButton = element("button", {
      className: "footer-button",
      type: "button",
      textContent: "Prev",
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
      type: "button",
      textContent: isLastStep ? "Exit" : "Next",
    });
    nextButton.addEventListener("click", () =>
      vscode.postMessage({ type: isLastStep ? "exit" : "next" }),
    );
    footer.appendChild(nextButton);

    panel.appendChild(box("card", [footer]));
    return panel;
  }

  function renderError(error) {
    return box("card error", [
      element("div", { className: "title", textContent: error.title }),
      error.fileName
        ? element("div", { className: "muted", textContent: error.fileName })
        : null,
      element("div", { textContent: error.detail }),
    ]);
  }

  function renderHeader(title, description) {
    const wrapper = element("div", { className: "header-copy" });
    wrapper.appendChild(element("div", { className: "title", textContent: title }));
    wrapper.appendChild(element("div", { className: "muted", textContent: description }));
    return wrapper;
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

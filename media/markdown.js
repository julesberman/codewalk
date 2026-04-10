(function () {
  function renderInto(container, markdown) {
    if (!(container instanceof HTMLElement)) {
      return;
    }

    container.replaceChildren(renderToFragment(markdown));
  }

  function renderToFragment(markdown) {
    const fragment = document.createDocumentFragment();
    tokenizeMarkdown(markdown).forEach((block) => fragment.appendChild(block));
    return fragment;
  }

  function tokenizeMarkdown(markdown) {
    const lines = String(markdown).replace(/\r\n/g, "\n").split("\n");
    const blocks = [];
    let paragraph = [];
    let listItems = [];
    let codeFence = null;

    const flushParagraph = () => {
      if (paragraph.length === 0) {
        return;
      }

      blocks.push(createHtmlElement("p", renderInline(paragraph.join(" "))));
      paragraph = [];
    };

    const flushList = () => {
      if (listItems.length === 0) {
        return;
      }

      const list = document.createElement("ul");
      listItems.forEach((item) => {
        list.appendChild(createHtmlElement("li", renderInline(item)));
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
        blocks.push(createHtmlElement(`h${Math.min(headingMatch[1].length, 4)}`, renderInline(headingMatch[2])));
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

    return blocks.length > 0 ? blocks : [createTextElement("p", markdown)];
  }

  function renderCodeBlock(code) {
    const pre = document.createElement("pre");
    const codeElement = document.createElement("code");
    codeElement.textContent = code;
    pre.appendChild(codeElement);
    return pre;
  }

  function renderInline(text) {
    let output = escapeHtml(text);
    output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
    output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      const safeHref = sanitizeHref(href);
      return safeHref ? `<a href="${safeHref}">${label}</a>` : label;
    });
    return output;
  }

  function sanitizeHref(href) {
    return /^(https?:|mailto:)/i.test(href) ? href : null;
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function createHtmlElement(tagName, html) {
    const node = document.createElement(tagName);
    node.innerHTML = html;
    return node;
  }

  function createTextElement(tagName, text) {
    const node = document.createElement(tagName);
    node.textContent = text;
    return node;
  }

  window.WalkthroughMarkdown = {
    renderInto,
    renderToFragment,
  };
})();

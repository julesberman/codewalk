import { escapeHtml } from "./webview";

export function renderMarkdownHtml(markdown: string): string {
  const lines = String(markdown).replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let codeFence: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }

    blocks.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    blocks.push(`<ul>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      if (codeFence === null) {
        codeFence = [];
      } else {
        blocks.push(`<pre><code>${escapeHtml(codeFence.join("\n"))}</code></pre>`);
        codeFence = null;
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
      const level = Math.min(headingMatch[1].length, 4);
      blocks.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
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
    blocks.push(`<pre><code>${escapeHtml(codeFence.join("\n"))}</code></pre>`);
  }

  return blocks.length > 0 ? blocks.join("") : `<p>${escapeHtml(markdown)}</p>`;
}

function renderInline(text: string): string {
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

function sanitizeHref(href: string): string | null {
  return /^(https?:|mailto:)/i.test(href) ? href : null;
}

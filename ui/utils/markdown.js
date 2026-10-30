export function renderMarkdown(value) {
  let text = escapeHtml(value);

  /*
    Protect fenced code blocks for now.

    Full fenced-code rendering is the
    NEXT feature after core Markdown.
  */
  const codeBlocks = [];

  text = text.replace(
    /```([^\n`]*)\n([\s\S]*?)```/g,
    (_, language, code) => {
      const index = codeBlocks.length;

      codeBlocks.push({
        language: language.trim().toLowerCase(),
        code,
      });

      return `@@CODEBLOCK_${index}@@`;
    },
  );

  /*
    Inline code.

    Example:
    `ipconfig /all`
  */
  text = text.replace(
    /`([^`\n]+)`/g,
    "<code>$1</code>",
  );

  /*
    Headings.
  */
  text = text.replace(
    /^### (.+)$/gm,
    "<h3>$1</h3>",
  );

  text = text.replace(
    /^## (.+)$/gm,
    "<h2>$1</h2>",
  );

  text = text.replace(
    /^# (.+)$/gm,
    "<h1>$1</h1>",
  );

  /*
    Blockquotes.
  */
  text = text.replace(
    /^&gt; (.+)$/gm,
    "<blockquote>$1</blockquote>",
  );

  /*
    Bold before italic.
  */
  text = text.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>",
  );

  text = text.replace(
    /__(.+?)__/g,
    "<strong>$1</strong>",
  );

  /*
    Italic.
  */
  text = text.replace(
    /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
    "<em>$1</em>",
  );

  text = text.replace(
    /(?<!_)_([^_\n]+)_(?!_)/g,
    "<em>$1</em>",
  );

  /*
    Markdown links.

    Because the original text was escaped
    first, arbitrary HTML from the model
    cannot be inserted directly.

    Only http/https links are converted.
  */
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  /*
    Unordered lists.
  */
  text = renderUnorderedLists(text);

  /*
    Ordered lists.
  */
  text = renderOrderedLists(text);

  /*
    Paragraph / line-break handling.
  */
  text = text
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();

      if (!trimmed) {
        return "";
      }

      if (
        /^<(h1|h2|h3|ul|ol|blockquote)/.test(
          trimmed,
        ) ||
        /^@@CODEBLOCK_\d+@@$/.test(trimmed)
      ) {
        return trimmed;
      }

      return `<p>${trimmed.replaceAll(
        "\n",
        "<br>",
      )}</p>`;
    })
    .join("");

  /*
    Restore fenced blocks as plain
    preformatted code.

    We'll enhance these with language
    labels + Copy Code in the next step.
  */
  text = text.replace(
  /@@CODEBLOCK_(\d+)@@/g,
  (_, index) => {
    const block = codeBlocks[Number(index)];

    if (!block) return "";

    const language = block.language || "plaintext";

    const displayLanguage = {
      js: "JavaScript",
      javascript: "JavaScript",
      ts: "TypeScript",
      typescript: "TypeScript",
      py: "Python",
      python: "Python",
      html: "HTML",
      css: "CSS",
      json: "JSON",
      bash: "Bash",
      sh: "Shell",
      sql: "SQL",
      powershell: "PowerShell",
      ps1: "PowerShell",
    }[language] || language;

    return `
  <div class="code-block">
    <div class="code-block-header">
      <span class="code-language">
        ${escapeHtml(displayLanguage)}
      </span>

      <button
        type="button"
        class="copy-code-button"
        aria-label="Copy code"
      >
        <span class="copy-code-icon">⧉</span>
        <span class="copy-code-label">Copy</span>
      </button>
    </div>

    <pre><code class="language-${escapeHtml(
      language.replace(/[^a-z0-9_-]/g, ""),
    )}">${block.code.replace(/\n$/, "")}</code></pre>
  </div>
`;
  },
);

  return text;
}

function renderUnorderedLists(text) {
  const lines = text.split("\n");
  const output = [];

  let inList = false;

  for (const line of lines) {
    const match = line.match(
      /^\s*[-*] (.+)$/,
    );

    if (match) {
      if (!inList) {
        output.push("<ul>");
        inList = true;
      }

      output.push(`<li>${match[1]}</li>`);
    } else {
      if (inList) {
        output.push("</ul>");
        inList = false;
      }

      output.push(line);
    }
  }

  if (inList) {
    output.push("</ul>");
  }

  return output.join("\n");
}

function renderOrderedLists(text) {
  const lines = text.split("\n");
  const output = [];

  let inList = false;

  for (const line of lines) {
    const match = line.match(
      /^\s*\d+\. (.+)$/,
    );

    if (match) {
      if (!inList) {
        output.push("<ol>");
        inList = true;
      }

      output.push(`<li>${match[1]}</li>`);
    } else {
      if (inList) {
        output.push("</ol>");
        inList = false;
      }

      output.push(line);
    }
  }

  if (inList) {
    output.push("</ol>");
  }

  return output.join("\n");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
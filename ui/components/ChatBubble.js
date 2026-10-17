import {
  renderMarkdown
} from "../utils/markdown.js";

export function ChatBubble(message) {
  const isUser = message.role === "user";
  const label = isUser ? "You" : "AI";
  const avatar = isUser ? "🧑" : "🤖";


  const content = isUser
    ? escapeHtml(message.content)
    : renderMarkdown(message.content);

  return `
    <div
      class="message-row ${isUser ? "user-row" : "ai-row"}"
      data-message-id="${escapeHtml(message.id)}"
    >
      <div class="avatar">${avatar}</div>

      <div class="message ${isUser ? "user" : "ai"}">
        <div class="message-label">${label}</div>

        <div
          class="message-content"
          data-message-content="${escapeHtml(message.id)}"
        >
          ${content}
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
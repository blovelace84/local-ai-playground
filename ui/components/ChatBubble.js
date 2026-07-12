export function ChatBubble(message) {
  const isUser = message.role === "user";
  const label = isUser ? "You" : "AI";
  const avatar = isUser ? "🧑" : "🤖";

  return `
    <div class="message-row ${isUser ? "user-row" : "ai-row"}">
      <div class="avatar">${avatar}</div>

      <div class="message ${isUser ? "user" : "ai"}">
        <div class="message-label">${label}</div>
        <div class="message-content">
          ${escapeHtml(message.content)}
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
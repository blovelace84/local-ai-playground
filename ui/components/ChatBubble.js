export function ChatBubble(message) {
    const isUser = message.role === "user";
    const label = isUser ? "You" : "AI";
    const avatar = isUser ? "🧑" : "🤖";

    return `
    <div class="message-row ${isUser ? "user-row" : "ai-row"}">
      <div class="avatar">${avatar}</div>

      <div class="message ${message.role}">
        <div class="message-label">${label}</div>
        <div class="message-content">${escapeHtml(message.content)}</div>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}
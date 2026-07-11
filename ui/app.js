import { chatStore } from "./stores/chatStore.js";
import { modelStore } from "./stores/modelStore.js";
import { ChatBubble } from "./components/ChatBubble.js";

const app = document.getElementById("app");

let isLoading = false;

chatStore.load();
await modelStore.loadModels();

function render() {
  const activeChat = chatStore.getActiveConversation();
  const messages = activeChat?.messages ?? [];

  app.innerHTML = `
    <main class="layout">
      <aside class="sidebar">
        <h2>Local AI</h2>

        <button id="newChatBtn" class="sidebar-button">
          + New Chat
        </button>

        <div class="sidebar-section">
          <p>Chats</p>

          ${chatStore.conversations.length === 0
      ? `<p class="empty-sidebar-text">No saved chats yet.</p>`
      : chatStore.conversations
        .map(
          (chat) => `
                      <button
                        class="chat-list-item ${chat.id === chatStore.activeConversationId
              ? "active-chat"
              : ""
            }"
                        data-chat-id="${chat.id}"
                      >
                        ${chat.title}
                      </button>
                    `,
        )
        .join("")
    }
        </div>

        <div class="sidebar-section model-section">
          <p>Model</p>

          <select id="modelSelect">
            ${modelStore.models.map((model) => `
              <option value="${model.name}" ${model.name === modelStore.selectedModel ? "selected" : ""}>
                ${model.name}
              </option>
            `).join("")}
          </select>
        </div>
      </aside>

      <section class="chat-area">
        <header class="topbar">
          <div>
            <h1>🤖 Local AI Playground</h1>
            <p>Private local AI powered by Ollama + Deno</p>
          </div>

          <div class="active-model-pill">
            ${modelStore.selectedModel}
          </div>
        </header>

        <section class="chat-box" id="chatBox">
          ${messages.length === 0
      ? `<p class="empty-state">No messages yet. Start a conversation.</p>`
      : messages.map(ChatBubble).join("")
    }
        </section>

        <section class="input-area">
          <textarea
            id="messageInput"
            placeholder="Ask your local AI..."
          ></textarea>

          <div class="input-actions">
            <button id="clearChatBtn" class="secondary-button">
              Clear Chat
            </button>

            <button id="sendBtn" ${isLoading ? "disabled" : ""}>
              ${isLoading ? "Thinking..." : "Send"}
            </button>
          </div>
        </section>
      </section>
    </main>
  `;

  bindEvents();
  scrollToBottom();
}

function bindEvents() {
  document.getElementById("sendBtn")?.addEventListener("click", sendMessage);

  document.getElementById("messageInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  document.getElementById("newChatBtn")?.addEventListener("click", () => {
    chatStore.createConversation();
    render();
  });

  document.getElementById("clearChatBtn")?.addEventListener("click", () => {
    chatStore.clearMessages();
    render();
  });

  document.querySelectorAll(".chat-list-item").forEach((button) => {
    button.addEventListener("click", () => {
      chatStore.setActiveConversation(button.dataset.chatId);
      render();
    });
  });

  const modelSelect = document.getElementById("modelSelect");

  if (modelSelect) {
    modelSelect.value = modelStore.selectedModel;

    modelSelect.addEventListener("change", (event) => {
      modelStore.setModel(event.target.value);
      render();
    });
  }
}

async function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input.value.trim();

  if (!message || isLoading) return;

  chatStore.addMessage("user", message);

  isLoading = true;
  render();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
       conversationId: chatStore.activeConversationId,
       model: modelStore.selectedModel,
       message,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      chatStore.addMessage("ai", data.error ?? "Something went wrong.");
    } else {
      chatStore.addMessage("ai", data.reply ?? "No response received.");
    }
  } catch (error) {
    chatStore.addMessage("ai", "Error: " + error.message);
  }

  isLoading = false;
  render();
}

function scrollToBottom() {
  const chatBox = document.getElementById("chatBox");

  if (chatBox) {
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

render();
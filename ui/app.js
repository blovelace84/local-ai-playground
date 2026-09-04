import { chatStore } from "./stores/chatStore.js";
import { modelStore } from "./stores/modelStore.js";
import { chatService } from "./services/chatService.js";
import { ChatBubble } from "./components/ChatBubble.js";

const app = document.getElementById("app");

let isLoading = false;
let errorMessage = "";

async function startApp() {
  try {
    await Promise.all([
      chatStore.initialize(),
      modelStore.loadModels(),
    ]);

    render();
  } catch (error) {
    errorMessage = getErrorMessage(error);
    render();
  }
}

function render() {
  const activeChat = chatStore.getActiveConversation();

  app.innerHTML = `
    <main class="layout">
      <aside class="sidebar">
        <h2>Local AI</h2>

        <button
          id="newChatBtn"
          class="sidebar-button"
          ${isLoading ? "disabled" : ""}
        >
          + New Chat
        </button>

        <div class="sidebar-section">
          <p>Chats</p>

          ${
            chatStore.conversations.length === 0
              ? `
                <p class="empty-sidebar-text">
                  No conversations yet.
                </p>
              `
              : chatStore.conversations
                  .map(
                    (conversation) => `
                      <div class="chat-list-row">
                        <button
                          class="chat-list-item ${
                            conversation.id ===
                                chatStore.activeConversationId
                              ? "active-chat"
                              : ""
                          }"
                          data-chat-id="${conversation.id}"
                          ${isLoading ? "disabled" : ""}
                        >
                          ${escapeHtml(conversation.title)}
                        </button>

                        <button
                          class="chat-action-button rename-chat-button"
                          data-chat-id="${conversation.id}"
                          title="Rename chat"
                          ${isLoading ? "disabled" : ""}
                        >
                          ✏️
                        </button>

                        <button
                          class="chat-action-button delete-chat-button"
                          data-chat-id="${conversation.id}"
                          title="Delete chat"
                          ${isLoading ? "disabled" : ""}
                        >
                          🗑️
                        </button>
                      </div>
                    `,
                  )
                  .join("")
          }
        </div>

        <div class="sidebar-section model-section">
          <p>Model</p>

          <select
            id="modelSelect"
            ${
              modelStore.models.length === 0 || isLoading
                ? "disabled"
                : ""
            }
          >
            ${
              modelStore.models.length === 0
                ? `
                  <option value="">
                    No models installed
                  </option>
                `
                : modelStore.models
                    .map(
                      (model) => `
                        <option value="${escapeHtml(model.name)}">
                          ${escapeHtml(model.name)}
                        </option>
                      `,
                    )
                    .join("")
            }
          </select>
        </div>
      </aside>

      <section class="chat-area">
        <header class="topbar">
          <div>
            <h1>🤖 Local AI Playground</h1>

            <p>
              ${
                activeChat
                  ? escapeHtml(activeChat.title)
                  : "No active conversation"
              }
            </p>
          </div>

          <div class="active-model-pill">
            ${escapeHtml(
              modelStore.selectedModel || "No model",
            )}
          </div>
        </header>

        <section
          class="chat-box"
          id="chatBox"
        >
          ${
            errorMessage
              ? `
                <div class="error-message">
                  ${escapeHtml(errorMessage)}
                </div>
              `
              : ""
          }

          ${
            chatStore.messages.length === 0
              ? `
                <p class="empty-state">
                  No messages yet.
                  Start a conversation.
                </p>
              `
              : chatStore.messages
                  .map(ChatBubble)
                  .join("")
          }
        </section>

        <section class="input-area">
          <textarea
            id="messageInput"
            placeholder="Ask your local AI..."
            ${isLoading ? "disabled" : ""}
          ></textarea>

          <div class="input-actions">
            <button
              id="clearChatBtn"
              class="secondary-button"
              ${isLoading ? "disabled" : ""}
            >
              Clear Chat
            </button>

            <button
              id="sendBtn"
              ${
                isLoading ||
                    !chatStore.activeConversationId ||
                    !modelStore.selectedModel
                  ? "disabled"
                  : ""
              }
            >
              ${isLoading ? "Thinking..." : "Send"}
            </button>
          </div>
        </section>
      </section>
    </main>
  `;

  bindEvents();

  const modelSelect =
    document.getElementById("modelSelect");

  if (
    modelSelect &&
    modelStore.selectedModel
  ) {
    modelSelect.value =
      modelStore.selectedModel;
  }

  scrollToBottom();
}

function bindEvents() {
  document
    .getElementById("sendBtn")
    ?.addEventListener(
      "click",
      sendMessage,
    );

  document
    .getElementById("messageInput")
    ?.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Enter" &&
          !event.shiftKey
        ) {
          event.preventDefault();

          sendMessage();
        }
      },
    );

  document
    .getElementById("newChatBtn")
    ?.addEventListener(
      "click",
      async () => {
        if (isLoading) return;

        await runAction(async () => {
          await chatStore.createConversation();
        });
      },
    );

  document
    .getElementById("clearChatBtn")
    ?.addEventListener(
      "click",
      async () => {
        if (
          !chatStore.activeConversationId ||
          isLoading
        ) {
          return;
        }

        const shouldClear = confirm(
          "Clear every message in this conversation?",
        );

        if (!shouldClear) {
          return;
        }

        await runAction(async () => {
          await chatStore.clearActiveConversation();
        });
      },
    );

  document
    .querySelectorAll(".chat-list-item")
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          if (isLoading) return;

          await runAction(async () => {
            await chatStore.selectConversation(
              button.dataset.chatId,
            );
          });
        },
      );
    });

  document
    .querySelectorAll(
      ".rename-chat-button",
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          if (isLoading) return;

          const id =
            button.dataset.chatId;

          const conversation =
            chatStore.conversations.find(
              (item) => item.id === id,
            );

          const title = prompt(
            "Enter a new title:",
            conversation?.title ?? "",
          )?.trim();

          if (!title) {
            return;
          }

          await runAction(async () => {
            await chatStore.renameConversation(
              id,
              title,
            );
          });
        },
      );
    });

  document
    .querySelectorAll(
      ".delete-chat-button",
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          if (isLoading) return;

          const shouldDelete = confirm(
            "Delete this conversation permanently?",
          );

          if (!shouldDelete) {
            return;
          }

          await runAction(async () => {
            await chatStore.deleteConversation(
              button.dataset.chatId,
            );
          });
        },
      );
    });

  document
    .getElementById("modelSelect")
    ?.addEventListener(
      "change",
      (event) => {
        modelStore.setModel(
          event.target.value,
        );

        render();
      },
    );
}

async function sendMessage() {
  const input =
    document.getElementById(
      "messageInput",
    );

  const message =
    input?.value.trim();

  if (
    !message ||
    isLoading ||
    !chatStore.activeConversationId ||
    !modelStore.selectedModel
  ) {
    return;
  }

  errorMessage = "";
  isLoading = true;

  const conversationId =
    chatStore.activeConversationId;

  /*
    Display the user's message immediately.
  */
  chatStore.addTemporaryMessage(
    "user",
    message,
  );

  /*
    Create an empty temporary assistant
    message that we will fill as chunks arrive.
  */
  const streamingMessage = {
    id: crypto.randomUUID(),
    conversationId,
    role: "assistant",
    content: "",
    createdAt:
      new Date().toISOString(),
    streaming: true,
  };

  chatStore.messages.push(
    streamingMessage,
  );

  render();

  try {
    const data =
      await chatService.sendMessage({
        conversationId,
        model:
          modelStore.selectedModel,
        message,

        onStart({
          conversationId:
            serverConversationId,
        }) {
          if (serverConversationId) {
            chatStore.activeConversationId =
              serverConversationId;

            streamingMessage.conversationId =
              serverConversationId;
          }
        },

        onChunk(chunk) {
          streamingMessage.content +=
            chunk;

          render();
        },
      });

    chatStore.activeConversationId =
      data.conversationId;

    /*
      Once streaming is finished,
      reload from SQLite.

      This replaces our temporary messages
      with the authoritative saved versions.
    */
    await Promise.all([
      chatStore.refreshConversations(),
      chatStore.loadActiveConversation(),
    ]);
  } catch (error) {
    errorMessage =
      getErrorMessage(error);

    /*
      Remove the empty assistant bubble
      if generation failed before any text
      was received.
    */
    if (!streamingMessage.content) {
      chatStore.messages =
        chatStore.messages.filter(
          (item) =>
            item.id !==
            streamingMessage.id,
        );
    }
  } finally {
    isLoading = false;

    render();
  }
}

async function runAction(action) {
  errorMessage = "";

  try {
    await action();
  } catch (error) {
    errorMessage =
      getErrorMessage(error);
  }

  render();
}

function scrollToBottom() {
  const chatBox =
    document.getElementById(
      "chatBox",
    );

  if (chatBox) {
    chatBox.scrollTop =
      chatBox.scrollHeight;
  }
}

function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred.";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

startApp();
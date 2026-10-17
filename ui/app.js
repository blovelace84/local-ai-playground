import { chatStore } from "./stores/chatStore.js";
import { modelStore } from "./stores/modelStore.js";
import { chatService } from "./services/chatService.js";
import { ChatBubble } from "./components/ChatBubble.js";
import { renderMarkdown } from "./utils/markdown.js";

const app = document.getElementById("app");

let isLoading = false;
let errorMessage = "";
let activeAbortController = null;
let streamingAnimationFrame = null;

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
  const activeChat =
    chatStore.getActiveConversation();

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
              modelStore.models.length === 0 ||
                  isLoading
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
              modelStore.selectedModel ||
                "No model",
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

            ${
              isLoading
                ? `
                  <button
                    id="stopBtn"
                    class="stop-button"
                  >
                    ■ Stop
                  </button>
                `
                : `
                  <button
                    id="sendBtn"
                    ${
                      !chatStore.activeConversationId ||
                          !modelStore.selectedModel
                        ? "disabled"
                        : ""
                    }
                  >
                    Send
                  </button>
                `
            }
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
    .getElementById("stopBtn")
    ?.addEventListener(
      "click",
      stopGeneration,
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

  /*
    Create a controller for this specific
    generation request.

    Pressing Stop will abort this controller.
  */
  activeAbortController =
    new AbortController();

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
    message.

    Streaming chunks will be appended to
    this object while Ollama generates.
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

  /*
    This full render is intentional.

    It adds the user's message, the empty
    assistant bubble, and switches Send
    to the Stop button.

    After this point, individual streaming
    chunks will NOT call render().
  */
  render();

  try {
    const data =
      await chatService.sendMessage({
        conversationId,

        model:
          modelStore.selectedModel,

        message,

        /*
          Pass the AbortController signal
          into fetch through chatService.
        */
        signal:
          activeAbortController.signal,

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
          /*
            Update our in-memory message.
          */
          streamingMessage.content +=
            chunk;

          /*
            IMPORTANT:
            Do NOT call render() here.

            Only update the streaming
            assistant bubble.
          */
          scheduleStreamingUpdate(
            streamingMessage,
          );
        },
      });

    chatStore.activeConversationId =
      data.conversationId;

    /*
      Generation completed normally.

      Reload from SQLite so our temporary
      messages are replaced by the
      authoritative persisted messages.
    */
    await Promise.all([
      chatStore.refreshConversations(),
      chatStore.loadActiveConversation(),
    ]);
  } catch (error) {
    if (isAbortError(error)) {
      /*
        Stop was intentionally pressed.

        Do not display AbortError to the
        user.

        Reload whatever state the backend
        successfully persisted.
      */
      try {
        await Promise.all([
          chatStore.refreshConversations(),
          chatStore.loadActiveConversation(),
        ]);
      } catch (reloadError) {
        errorMessage =
          getErrorMessage(reloadError);
      }
    } else {
      /*
        This is an actual error rather
        than an intentional cancellation.
      */
      errorMessage =
        getErrorMessage(error);

      /*
        If generation failed before any
        assistant text arrived, remove
        the empty temporary AI bubble.
      */
      if (!streamingMessage.content) {
        chatStore.messages =
          chatStore.messages.filter(
            (item) =>
              item.id !==
              streamingMessage.id,
          );
      }
    }
  } finally {
    /*
      Cancel any visual update that may
      still be waiting for the browser's
      next animation frame.
    */
    if (
      streamingAnimationFrame !== null
    ) {
      cancelAnimationFrame(
        streamingAnimationFrame,
      );

      streamingAnimationFrame = null;
    }

    isLoading = false;
    activeAbortController = null;

    /*
      A full render is appropriate here
      because generation has finished or
      has been stopped.
    */
    render();
  }
}

/*
  Schedule one visual streaming update
  for the browser's next animation frame.

  If several Ollama chunks arrive before
  that frame, they are combined into the
  same visual update.
*/
function scheduleStreamingUpdate(
  message,
) {
  if (
    streamingAnimationFrame !== null
  ) {
    return;
  }

  streamingAnimationFrame =
    requestAnimationFrame(() => {
      streamingAnimationFrame = null;

      updateStreamingMessage(
        message,
      );
    });
}

/*
  Update ONLY the current assistant
  message instead of rebuilding the
  entire application.
*/
function updateStreamingMessage(
  message,
) {
  const messageContent =
    document.querySelector(
      `[data-message-content="${message.id}"]`,
    );

  if (!messageContent) {
    return;
  }

  const chatBox =
    document.getElementById(
      "chatBox",
    );

  /*
    Determine whether the user was already
    following the bottom of the response.

    If they manually scrolled upward,
    don't force them back down.
  */
  const shouldFollow =
    isNearBottom(chatBox);

  messageContent.innerHTML = 
    renderMarkdown(message.content);
  

  if (
    shouldFollow &&
    chatBox
  ) {
    chatBox.scrollTop =
      chatBox.scrollHeight;
  }
}

/*
  Consider the user to be following the
  response when they are within 100px of
  the bottom.
*/
function isNearBottom(element) {
  if (!element) {
    return false;
  }

  const distanceFromBottom =
    element.scrollHeight -
    element.scrollTop -
    element.clientHeight;

  return distanceFromBottom < 100;
}

/*
  Stop the currently active generation.
*/
function stopGeneration() {
  if (!activeAbortController) {
    return;
  }

  activeAbortController.abort();
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

/*
  Used for full application renders,
  such as loading/opening a conversation.

  Streaming chunks themselves do not
  invoke this function anymore.
*/
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

/*
  AbortError means the user intentionally
  pressed Stop. It should not be shown as
  an application error.
*/
function isAbortError(error) {
  return (
    error instanceof DOMException &&
    error.name === "AbortError"
  );
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
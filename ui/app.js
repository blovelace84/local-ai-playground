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
  } catch (error) {
    errorMessage = getErrorMessage(error);
  }

  render();
}

function render() {
  const activeChat = chatStore.getActiveConversation();
  const lastMessage = chatStore.messages.at(-1);
  const previousMessage = chatStore.messages.at(-2);

  const latestAssistantId = lastMessage?.role === "assistant" &&
      !lastMessage.streaming
    ? lastMessage.id
    : null;

  const latestEditableUserId = lastMessage?.role === "assistant" &&
      !lastMessage.streaming &&
      previousMessage?.role === "user"
    ? previousMessage.id
    : null;

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
      : chatStore.conversations.map(
        (conversation) => `
                  <div class="chat-list-row">
                    <button
                      class="chat-list-item ${
          conversation.id ===
              chatStore.activeConversationId
            ? "active-chat"
            : ""
        }"
                      data-chat-id="${escapeHtml(conversation.id)}"
                      ${isLoading ? "disabled" : ""}
                    >
                      ${escapeHtml(conversation.title)}
                    </button>

                    <button
                      class="chat-action-button rename-chat-button"
                      data-chat-id="${escapeHtml(conversation.id)}"
                      title="Rename chat"
                      ${isLoading ? "disabled" : ""}
                    >
                      ✏️
                    </button>

                    <button
                      class="chat-action-button delete-chat-button"
                      data-chat-id="${escapeHtml(conversation.id)}"
                      title="Delete chat"
                      ${isLoading ? "disabled" : ""}
                    >
                      🗑️
                    </button>
                  </div>
                `,
      ).join("")
  }
        </div>

        <div class="sidebar-section model-section">
          <p>Model</p>

          <select
            id="modelSelect"
            ${modelStore.models.length === 0 || isLoading ? "disabled" : ""}
          >
            ${
    modelStore.models.length === 0
      ? `<option value="">No models installed</option>`
      : modelStore.models.map(
        (model) => `
                    <option value="${escapeHtml(model.name)}">
                      ${escapeHtml(model.name)}
                    </option>
                  `,
      ).join("")
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
    activeChat ? escapeHtml(activeChat.title) : "No active conversation"
  }
            </p>
          </div>

          <div class="active-model-pill">
            ${escapeHtml(modelStore.selectedModel || "No model")}
          </div>
        </header>

        <section class="chat-box" id="chatBox">
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
        .map((message) => ChatBubble(message, {
            canRegenerate: message.id === latestAssistantId,
            canEdit: message.id === latestEditableUserId,
            isLoading,
        }))
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
                  <button id="stopBtn" class="stop-button">
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

  const modelSelect = document.getElementById("modelSelect");

  if (modelSelect && modelStore.selectedModel) {
    modelSelect.value = modelStore.selectedModel;
  }

  scrollToBottom();
}

function bindEvents() {
  document.getElementById("sendBtn")
    ?.addEventListener("click", sendMessage);

  document.getElementById("stopBtn")
    ?.addEventListener("click", stopGeneration);

  document.getElementById("messageInput")
    ?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });

  document.getElementById("newChatBtn")
    ?.addEventListener("click", async () => {
      if (isLoading) return;

      await runAction(async () => {
        await chatStore.createConversation();
      });
    });

  document.getElementById("clearChatBtn")
    ?.addEventListener("click", async () => {
      if (
        isLoading ||
        !chatStore.activeConversationId
      ) {
        return;
      }

      if (!confirm("Clear every message in this conversation?")) {
        return;
      }

      await runAction(async () => {
        await chatStore.clearActiveConversation();
      });
    });

  document.querySelectorAll(".chat-list-item")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        if (isLoading) return;

        await runAction(async () => {
          await chatStore.selectConversation(
            button.dataset.chatId,
          );
        });
      });
    });

  document.querySelectorAll(".rename-chat-button")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        if (isLoading) return;

        const id = button.dataset.chatId;

        const conversation = chatStore.conversations.find(
          (item) => item.id === id,
        );

        const title = prompt(
          "Enter a new title:",
          conversation?.title ?? "",
        )?.trim();

        if (!title) return;

        await runAction(async () => {
          await chatStore.renameConversation(id, title);
        });
      });
    });

  document.querySelectorAll(".delete-chat-button")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        if (isLoading) return;

        if (!confirm("Delete this conversation permanently?")) {
          return;
        }

        await runAction(async () => {
          await chatStore.deleteConversation(
            button.dataset.chatId,
          );
        });
      });
    });

  document.getElementById("modelSelect")
    ?.addEventListener("change", (event) => {
      modelStore.setModel(event.target.value);
      render();
    });
}

async function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input?.value.trim();

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

  const controller = new AbortController();
  activeAbortController = controller;

  const conversationId = chatStore.activeConversationId;

  chatStore.addTemporaryMessage("user", message);

  const streamingMessage = {
    id: crypto.randomUUID(),
    conversationId,
    role: "assistant",
    content: "",
    createdAt: new Date().toISOString(),
    streaming: true,
  };

  chatStore.messages.push(streamingMessage);
  render();

  try {
    const data = await chatService.sendMessage({
      conversationId,
      model: modelStore.selectedModel,
      message,
      signal: controller.signal,

      onStart({ conversationId: serverId }) {
        if (serverId) {
          chatStore.activeConversationId = serverId;
          streamingMessage.conversationId = serverId;
        }
      },

      onChunk(chunk) {
        streamingMessage.content += chunk;
        scheduleStreamingUpdate(streamingMessage);
      },
    });

    chatStore.activeConversationId = data.conversationId;

    await reloadConversation();
  } catch (error) {
    if (isAbortError(error)) {
      try {
        await reloadConversation();
      } catch (reloadError) {
        errorMessage = getErrorMessage(reloadError);
      }
    } else {
      errorMessage = getErrorMessage(error);

      try {
        await reloadConversation();
      } catch {
        if (!streamingMessage.content) {
          chatStore.messages = chatStore.messages.filter(
            (item) => item.id !== streamingMessage.id,
          );
        }
      }
    }
  } finally {
    finishGeneration();
  }
}

async function regenerateResponse(assistantMessageId) {
  if (isLoading || !modelStore.selectedModel) return;

  const conversationId = chatStore.activeConversationId;
  const savedMessages = chatStore.messages;
  const last = savedMessages.at(-1);
  const previous = savedMessages.at(-2);

  if (
    !conversationId ||
    !last ||
    last.id !== assistantMessageId ||
    last.role !== "assistant" ||
    last.streaming ||
    !previous ||
    previous.role !== "user"
  ) {
    return;
  }

  errorMessage = "";
  isLoading = true;

  const controller = new AbortController();
  activeAbortController = controller;

  const streamingMessage = {
    ...last,
    content: "",
    streaming: true,
  };

  chatStore.messages = [
    ...savedMessages.slice(0, -1),
    streamingMessage,
  ];

  render();

  try {
    await chatService.sendMessage({
      conversationId,
      model: modelStore.selectedModel,
      regenerate: true,
      assistantMessageId,
      signal: controller.signal,

      onChunk(chunk) {
        streamingMessage.content += chunk;
        scheduleStreamingUpdate(streamingMessage);
      },
    });

    await reloadConversation();
  } catch (error) {
    if (!isAbortError(error)) {
      errorMessage = getErrorMessage(error);
    }

    chatStore.messages = savedMessages;
  } finally {
    finishGeneration();
  }
}


function openMessageEditor(messageId, originalContent) {
  return new Promise((resolve) => {
    const messageElement = Array.from(
      document.querySelectorAll("[data-message-id]"),
    ).find((element) =>
      element.dataset.messageId === messageId
    );

    if (!messageElement) {
      errorMessage = "Could not find the message to edit.";
      render();
      resolve(null);
      return;
    }

    const originalHTML = messageElement.innerHTML;

    const editor = document.createElement("div");
    editor.className = "inline-message-editor";

    const textarea = document.createElement("textarea");
    textarea.className = "inline-edit-textarea";
    textarea.value = originalContent;
    textarea.rows = 4;

    const actions = document.createElement("div");
    actions.className = "inline-edit-actions";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.textContent = "Save & Resend";

    actions.append(cancelButton, saveButton);
    editor.append(textarea, actions);

    messageElement.replaceChildren(editor);

    let finished = false;

    function finish(value) {
      if (finished) return;
      finished = true;

      // Restore the original message while the caller
      // prepares the generation request.
      if (messageElement.isConnected) {
        messageElement.innerHTML = originalHTML;
      }

      resolve(value);
    }

    cancelButton.addEventListener("click", () => {
      finish(null);
    });

    saveButton.addEventListener("click", () => {
      const value = textarea.value.trim();

      if (!value) {
        textarea.setCustomValidity(
          "Your question cannot be empty.",
        );
        textarea.reportValidity();
        return;
      }

      finish(value);
    });

    textarea.addEventListener("input", () => {
      textarea.setCustomValidity("");
    });

    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(null);
      }

      if (
        event.key === "Enter" &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();
        saveButton.click();
      }
    });

    textarea.focus();
    textarea.setSelectionRange(
      textarea.value.length,
      textarea.value.length,
    );
  });
}

async function editAndResendMessage(userMessageId) {
  if (isLoading || !modelStore.selectedModel) return;

  const conversationId = chatStore.activeConversationId;
  const savedMessages = chatStore.messages;
  const last = savedMessages.at(-1);
  const previous = savedMessages.at(-2);

  if (
    !conversationId ||
    !last ||
    last.role !== "assistant" ||
    last.streaming ||
    !previous ||
    previous.role !== "user" ||
    previous.id !== userMessageId
  ) {
    return;
  }

  
const newQuestion = await openMessageEditor(
  previous.id,
  previous.content,
);

if (newQuestion === null) {
  return;
}

if (!newQuestion.trim()) {
  errorMessage = "Your question cannot be empty.";
  render();
  return;
}

if (newQuestion === previous.content.trim()) {
  return;
}

  errorMessage = "";
  isLoading = true;

  const controller = new AbortController();
  activeAbortController = controller;

  // Preview only: SQLite still has the original messages.
  const editedUserMessage = {
    ...previous,
    content: newQuestion,
  };

  const streamingMessage = {
    ...last,
    content: "",
    streaming: true,
  };

  chatStore.messages = [
    ...savedMessages.slice(0, -2),
    editedUserMessage,
    streamingMessage,
  ];

  render();

  try {
    await chatService.sendMessage({
      conversationId,
      model: modelStore.selectedModel,
      message: newQuestion,
      editAndResend: true,
      userMessageId: previous.id,
      assistantMessageId: last.id,
      signal: controller.signal,

      onChunk(chunk) {
        streamingMessage.content += chunk;
        scheduleStreamingUpdate(streamingMessage);
      },
    });

    // Replace the preview with the saved SQLite version.
    await reloadConversation();
  } catch (error) {
    if (!isAbortError(error)) {
      errorMessage = getErrorMessage(error);
    }

    // Restore the original question and answer.
    chatStore.messages = savedMessages;
  } finally {
    finishGeneration();
  }
}

async function reloadConversation() {
  await Promise.all([
    chatStore.refreshConversations(),
    chatStore.loadActiveConversation(),
  ]);
}

function finishGeneration() {
  if (streamingAnimationFrame !== null) {
    cancelAnimationFrame(streamingAnimationFrame);
    streamingAnimationFrame = null;
  }

  isLoading = false;
  activeAbortController = null;
  render();
}

function scheduleStreamingUpdate(message) {
  if (streamingAnimationFrame !== null) return;

  streamingAnimationFrame = requestAnimationFrame(() => {
    streamingAnimationFrame = null;
    updateStreamingMessage(message);
  });
}

function updateStreamingMessage(message) {
  const messageContent = document.querySelector(
    `[data-message-content="${message.id}"]`,
  );

  if (!messageContent) return;

  const chatBox = document.getElementById("chatBox");
  const shouldFollow = isNearBottom(chatBox);

  messageContent.innerHTML = renderMarkdown(message.content);

  if (shouldFollow && chatBox) {
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

function isNearBottom(element) {
  if (!element) return false;

  const distanceFromBottom = element.scrollHeight -
    element.scrollTop -
    element.clientHeight;

  return distanceFromBottom < 100;
}

function stopGeneration() {
  activeAbortController?.abort();
}

async function runAction(action) {
  errorMessage = "";

  try {
    await action();
  } catch (error) {
    errorMessage = getErrorMessage(error);
  }

  render();
}

function scrollToBottom() {
  const chatBox = document.getElementById("chatBox");

  if (chatBox) {
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

function isAbortError(error) {
  return (
    error instanceof Error &&
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

// Event delegation survives full renders.
app.addEventListener("click", (event) => {
  const button = event.target.closest(".regenerate-button");

  if (!button || isLoading) return;

  regenerateResponse(button.dataset.regenerateId);
});

app.addEventListener("click", (event) => {
  const button = event.target.closest(".edit-message-button");

  if (!button || isLoading) return;

  editAndResendMessage(button.dataset.editId);
});

app.addEventListener("click", async (event) => {
  const button = event.target.closest(".copy-code-button");

  if (!button) return;

  const codeBlock = button.closest(".code-block");
  const codeElement = codeBlock?.querySelector("pre code");

  if (!codeElement) return;

  try {
    await navigator.clipboard.writeText(
      codeElement.textContent,
    );

    const label = button.querySelector(".copy-code-label");

    if (label) {
      label.textContent = "Copied!";
    }

    button.classList.add("copied");

    setTimeout(() => {
      if (label?.isConnected) {
        label.textContent = "Copy";
      }

      if (button.isConnected) {
        button.classList.remove("copied");
      }
    }, 2000);
  } catch (error) {
    console.error("Failed to copy code:", error);
  }
});

app.addEventListener("click", (event) => {
  const button = event.target.closest(".edit-message-button");

  if (!button || isLoading) return;

  editAndResendMessage(button.dataset.editId);
});
startApp();
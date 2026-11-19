import { streamModel } from "../model/runner.ts";

import {
  addMessage,
  getMessages,
  replaceAssistantMessage,
  replaceQuestionAndAnswer,
} from "../database/messageRepository.ts";

import {
  createConversation,
  getConversationById,
  renameConversation,
} from "../database/conversationRepository.ts";

type ChatRequestBody = {
  conversationId?: string;
  model?: string;
  message?: string;
  regenerate?: boolean;
  assistantMessageId?: string;
  editAndResend?: boolean;
  userMessageId?: string;
};

export async function handleChatApi(
  req: Request,
): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405 },
    );
  }

  let body: ChatRequestBody;

  try {
    body = await req.json() as ChatRequestBody;
  } catch {
    return Response.json(
      { error: "Invalid JSON request." },
      { status: 400 },
    );
  }

  const regenerating = body.regenerate === true;
  const editing = body.editAndResend === true;

  if (regenerating && editing) {
    return Response.json(
      {
        error: "Cannot edit and regenerate simultaneously.",
      },
      { status: 400 },
    );
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";

  let conversationId = body.conversationId;

  if (regenerating || editing) {
    if (!conversationId || !body.assistantMessageId) {
      return Response.json(
        {
          error: "Conversation and assistant message IDs are required.",
        },
        { status: 400 },
      );
    }

    if (!getConversationById(conversationId)) {
      return Response.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    if (editing && (!body.userMessageId || !message)) {
      return Response.json(
        {
          error: "An edited question and user message ID are required.",
        },
        { status: 400 },
      );
    }
  } else {
    if (!message) {
      return Response.json(
        { error: "A non-empty message is required." },
        { status: 400 },
      );
    }

    if (
      !conversationId ||
      !getConversationById(conversationId)
    ) {
      conversationId = createConversation().id;
    }

    addMessage(conversationId, "user", message);

    if (
      getConversationById(conversationId)?.title === "New Chat"
    ) {
      renameConversation(
        conversationId,
        createTitle(message),
      );
    }
  }

  const resolvedConversationId = conversationId!;

  const savedMessages = getMessages(
    resolvedConversationId,
  );

  let modelMessages = savedMessages.map(
    ({ role, content }) => ({ role, content }),
  );

  if (regenerating || editing) {
    const latest = savedMessages.at(-1);
    const previous = savedMessages.at(-2);

    if (
      !latest ||
      latest.id !== body.assistantMessageId ||
      latest.role !== "assistant" ||
      !previous ||
      previous.role !== "user" ||
      (editing && previous.id !== body.userMessageId)
    ) {
      return Response.json(
        {
          error: "Only the latest question and answer can be updated.",
        },
        { status: 409 },
      );
    }

    // Exclude the old assistant response from Ollama context.
    modelMessages = modelMessages.slice(0, -1);

    if (editing) {
      // Use the revised question for generation.
      // Do not change SQLite until generation succeeds.
      modelMessages[modelMessages.length - 1] = {
        role: "user",
        content: message,
      };
    }
  }

  const abortController = new AbortController();

  const cancelGeneration = () => {
    abortController.abort();
  };

  req.signal.addEventListener(
    "abort",
    cancelGeneration,
    { once: true },
  );

  if (req.signal.aborted) {
    cancelGeneration();
  }

  const encoder = new TextEncoder();
  let streamCancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function emit(event: Record<string, unknown>) {
        if (
          streamCancelled ||
          abortController.signal.aborted
        ) {
          return;
        }

        controller.enqueue(
          encoder.encode(
            `${JSON.stringify(event)}\n`,
          ),
        );
      }

      try {
        abortController.signal.throwIfAborted();

        emit({
          type: "start",
          conversationId: resolvedConversationId,
        });

        const fullResponse = await streamModel(
          modelMessages,
          body.model,
          (chunk) => {
            emit({
              type: "chunk",
              content: chunk,
            });
          },
          abortController.signal,
        );

        abortController.signal.throwIfAborted();

        if (streamCancelled) {
          return;
        }

        // Persist only after successful generation.
        if (editing) {
          replaceQuestionAndAnswer(
            resolvedConversationId,
            body.userMessageId!,
            body.assistantMessageId!,
            message,
            fullResponse,
          );
        } else if (regenerating) {
          replaceAssistantMessage(
            resolvedConversationId,
            body.assistantMessageId!,
            fullResponse,
          );
        } else {
          addMessage(
            resolvedConversationId,
            "assistant",
            fullResponse,
          );
        }

        emit({
          type: "done",
          conversationId: resolvedConversationId,
        });
      } catch (error) {
        if (
          !abortController.signal.aborted &&
          !streamCancelled
        ) {
          emit({
            type: "error",
            error: error instanceof Error
              ? error.message
              : "AI generation failed.",
          });
        }
      } finally {
        req.signal.removeEventListener(
          "abort",
          cancelGeneration,
        );

        if (!streamCancelled) {
          controller.close();
        }
      }
    },

    cancel() {
      streamCancelled = true;
      cancelGeneration();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}

function createTitle(message: string): string {
  const maximumLength = 40;

  return message.length <= maximumLength
    ? message
    : `${message.slice(0, maximumLength).trim()}…`;
}

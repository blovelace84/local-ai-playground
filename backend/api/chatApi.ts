
import { streamModel } from "../model/runner.ts";

import {
  addMessage,
  getMessages,
  replaceAssistantMessage,
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

  const isRegeneration = body.regenerate === true;
  const message = body.message?.trim();

  let conversationId = body.conversationId;
  let assistantMessageId: string | undefined;

  if (isRegeneration) {
    if (!conversationId || !body.assistantMessageId) {
      return Response.json(
        { error: "Conversation and assistant message IDs are required." },
        { status: 400 },
      );
    }

    if (!getConversationById(conversationId)) {
      return Response.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    assistantMessageId = body.assistantMessageId;
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

    addMessage(
      conversationId,
      "user",
      message,
    );

    const conversation =
      getConversationById(conversationId);

    if (conversation?.title === "New Chat") {
      renameConversation(
        conversationId,
        createTitle(message),
      );
    }
  }

  const savedMessages = getMessages(conversationId);

  let modelMessages = savedMessages.map(
    (savedMessage) => ({
      role: savedMessage.role,
      content: savedMessage.content,
    }),
  );

  if (isRegeneration) {
    const last = savedMessages.at(-1);
    const previous = savedMessages.at(-2);

    if (
      !last ||
      last.id !== assistantMessageId ||
      last.role !== "assistant" ||
      !previous ||
      previous.role !== "user"
    ) {
      return Response.json(
        {
          error:
            "Only the latest assistant response can be regenerated.",
        },
        { status: 409 },
      );
    }

    // Exclude the old assistant answer.
    modelMessages = savedMessages
      .slice(0, -1)
      .map((savedMessage) => ({
        role: savedMessage.role,
        content: savedMessage.content,
      }));
  }

  const resolvedConversationId = conversationId;
  const resolvedAssistantMessageId = assistantMessageId;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let streamClosed = false;

      function emit(event: Record<string, unknown>) {
        if (!streamClosed) {
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify(event)}\n`,
            ),
          );
        }
      }

      try {
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
        );

        if (isRegeneration) {
          replaceAssistantMessage(
            resolvedConversationId,
            resolvedAssistantMessageId!,
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
        emit({
          type: "error",
          error:
            error instanceof Error
              ? error.message
              : "AI generation failed.",
        });
      } finally {
        if (!streamClosed) {
          streamClosed = true;
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type":
        "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}

function createTitle(message: string): string {
  const maximumLength = 40;

  if (message.length <= maximumLength) {
    return message;
  }

  return `${message.slice(0, maximumLength).trim()}…`;
}

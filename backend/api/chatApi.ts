import { streamModel } from "../model/runner.ts";

import {
  addMessage,
  getMessages,
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

  const body = await req.json() as ChatRequestBody;
  const message = body.message?.trim();

  if (!message) {
    return Response.json(
      { error: "A non-empty message is required." },
      { status: 400 },
    );
  }

  let conversationId = body.conversationId;

  if (conversationId) {
    const existingConversation =
      getConversationById(conversationId);

    if (!existingConversation) {
      const conversation = createConversation();
      conversationId = conversation.id;
    }
  } else {
    const conversation = createConversation();
    conversationId = conversation.id;
  }

  addMessage(
    conversationId,
    "user",
    message,
  );

  const messages = getMessages(
    conversationId,
  ).map((savedMessage) => ({
    role: savedMessage.role,
    content: savedMessage.content,
  }));

  const conversation =
    getConversationById(conversationId);

  if (conversation?.title === "New Chat") {
    renameConversation(
      conversationId,
      createTitle(message),
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        sendEvent(controller, encoder, {
          type: "start",
          conversationId,
        });

        const fullResponse = await streamModel(
          messages,
          body.model,
          (chunk) => {
            sendEvent(controller, encoder, {
              type: "chunk",
              content: chunk,
            });
          },
        );

        addMessage(
          conversationId,
          "assistant",
          fullResponse,
        );

        sendEvent(controller, encoder, {
          type: "done",
          conversationId,
        });

        controller.close();
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unexpected streaming error occurred.";

        sendEvent(controller, encoder, {
          type: "error",
          error: errorMessage,
        });

        controller.close();
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

function sendEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: Record<string, unknown>,
): void {
  controller.enqueue(
    encoder.encode(
      `${JSON.stringify(event)}\n`,
    ),
  );
}

function createTitle(message: string): string {
  const maximumLength = 40;

  if (message.length <= maximumLength) {
    return message;
  }

  return `${message.slice(0, maximumLength).trim()}…`;
}
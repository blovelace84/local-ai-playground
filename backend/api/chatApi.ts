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

export async function handleChatApi(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: ChatRequestBody;
  try {
    body = await req.json() as ChatRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  const regenerating = body.regenerate === true;
  const message = body.message?.trim();
  let conversationId = body.conversationId;

  if (regenerating) {
    if (!conversationId || !body.assistantMessageId) {
      return Response.json({ error: "Conversation and assistant message IDs are required." }, { status: 400 });
    }
    if (!getConversationById(conversationId)) {
      return Response.json({ error: "Conversation not found." }, { status: 404 });
    }
  } else {
    if (!message) {
      return Response.json({ error: "A non-empty message is required." }, { status: 400 });
    }
    if (!conversationId || !getConversationById(conversationId)) {
      conversationId = createConversation().id;
    }
    addMessage(conversationId, "user", message);
    if (getConversationById(conversationId)?.title === "New Chat") {
      renameConversation(conversationId, createTitle(message));
    }
  }

  // conversationId is established in either branch above.
  const resolvedConversationId = conversationId!;
  const savedMessages = getMessages(resolvedConversationId);
  let modelMessages = savedMessages.map(({ role, content }) => ({ role, content }));

  if (regenerating) {
    const latest = savedMessages.at(-1);
    const previous = savedMessages.at(-2);
    if (
      !latest || latest.id !== body.assistantMessageId ||
      latest.role !== "assistant" || !previous || previous.role !== "user"
    ) {
      return Response.json(
        { error: "Only the latest assistant response can be regenerated." },
        { status: 409 },
      );
    }
    modelMessages = modelMessages.slice(0, -1);
  }

  const abortController = new AbortController();
  const cancelGeneration = () => abortController.abort();
  req.signal.addEventListener("abort", cancelGeneration, { once: true });
  if (req.signal.aborted) cancelGeneration();

  const encoder = new TextEncoder();
  let streamCancelled = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function emit(event: Record<string, unknown>) {
        if (streamCancelled || abortController.signal.aborted) return;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }

      try {
        abortController.signal.throwIfAborted();
        emit({ type: "start", conversationId: resolvedConversationId });

        const fullResponse = await streamModel(
          modelMessages,
          body.model,
          (chunk) => emit({ type: "chunk", content: chunk }),
          abortController.signal,
        );

        abortController.signal.throwIfAborted();
        if (streamCancelled) return;
        if (regenerating) {
          replaceAssistantMessage(
            resolvedConversationId,
            body.assistantMessageId!,
            fullResponse,
          );
        } else {
          addMessage(resolvedConversationId, "assistant", fullResponse);
        }
        emit({ type: "done", conversationId: resolvedConversationId });
      } catch (error) {
        if (!abortController.signal.aborted && !streamCancelled) {
          emit({
            type: "error",
            error: error instanceof Error ? error.message : "AI generation failed.",
          });
        }
      } finally {
        req.signal.removeEventListener("abort", cancelGeneration);
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

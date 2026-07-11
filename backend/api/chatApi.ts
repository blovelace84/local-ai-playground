import { runModel } from "../model/runner.ts";
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

export async function handleChatApi(req: Request): Promise<Response> {
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

  // Old localStorage IDs may not exist in SQLite.
  // If the conversation cannot be found, create a new database conversation.
  if (conversationId) {
    const existingConversation = getConversationById(conversationId);

    if (!existingConversation) {
      const conversation = createConversation();
      conversationId = conversation.id;
    }
  } else {
    const conversation = createConversation();
    conversationId = conversation.id;
  }

  addMessage(conversationId, "user", message);

  const messages = getMessages(conversationId).map((savedMessage) => ({
    role: savedMessage.role,
    content: savedMessage.content,
  }));

  const reply = await runModel(messages, body.model);

  addMessage(conversationId, "assistant", reply);

  const conversation = getConversationById(conversationId);

  if (conversation?.title === "New Chat") {
    renameConversation(conversationId, createTitle(message));
  }

  return Response.json({
    conversationId,
    reply,
  });
}

function createTitle(message: string): string {
  const maximumLength = 40;

  if (message.length <= maximumLength) {
    return message;
  }

  return `${message.slice(0, maximumLength).trim()}…`;
}
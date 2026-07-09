import { runModel } from "../model/runner.ts";
import { addMessage, getMessages } from "../database/messageRepository.ts";
import { createConversation } from "../database/conversationRepository.ts";

export async function handleChatApi(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const body = await req.json();

  let conversationId = body.conversationId;

  if (!conversationId) {
    const conversation = createConversation();
    conversationId = conversation.id;
  }

  addMessage(conversationId, "user", body.message);

  const messages = getMessages(conversationId).map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const reply = await runModel(messages, body.model);

  addMessage(conversationId, "assistant", reply);

  return Response.json({
    conversationId,
    reply,
  });
}
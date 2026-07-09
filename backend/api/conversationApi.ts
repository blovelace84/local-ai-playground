import {
  createConversation,
  deleteConversation,
  getAllConversations,
  getConversationById,
  renameConversation,
} from "../database/conversationRepository.ts";

import {
  addMessage,
  deleteMessages,
  getMessages,
} from "../database/messageRepository.ts";

export async function handleConversationApi(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/api/conversations") {
    const conversations = getAllConversations();
    return Response.json({ conversations });
  }

  if (req.method === "POST" && url.pathname === "/api/conversations") {
    const conversation = createConversation();
    return Response.json({ conversation });
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/conversations/")) {
    const id = url.pathname.split("/")[3];

    const conversation = getConversationById(id);

    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    const messages = getMessages(id);

    return Response.json({
      conversation,
      messages,
    });
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/conversations/")) {
    const id = url.pathname.split("/")[3];
    const body = await req.json();

    const conversation = renameConversation(id, body.title);

    return Response.json({ conversation });
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/conversations/")) {
    const id = url.pathname.split("/")[3];

    deleteConversation(id);

    return Response.json({ success: true });
  }

  if (
    req.method === "DELETE" &&
    url.pathname.startsWith("/api/conversations/") &&
    url.pathname.endsWith("/messages")
  ) {
    const id = url.pathname.split("/")[3];

    deleteMessages(id);

    return Response.json({ success: true });
  }

  return Response.json({ error: "Conversation route not found" }, { status: 404 });
}
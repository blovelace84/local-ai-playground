import {
  createConversation,
  deleteConversation,
  getAllConversations,
  getConversationById,
  renameConversation,
} from "../database/conversationRepository.ts";

import {
  deleteMessages,
  getMessages,
} from "../database/messageRepository.ts";

type RenameBody = {
  title?: string;
};

export async function handleConversationApi(
  req: Request,
): Promise<Response> {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  // GET /api/conversations
  if (
    req.method === "GET" &&
    url.pathname === "/api/conversations"
  ) {
    return Response.json({
      conversations: getAllConversations(),
    });
  }

  // POST /api/conversations
  if (
    req.method === "POST" &&
    url.pathname === "/api/conversations"
  ) {
    const conversation = createConversation();

    return Response.json(
      { conversation },
      { status: 201 },
    );
  }

  const conversationId = pathParts[2];

  if (!conversationId) {
    return Response.json(
      { error: "Conversation ID is required." },
      { status: 400 },
    );
  }

  // DELETE /api/conversations/:id/messages
  // This must appear before the general conversation DELETE route.
  if (
    req.method === "DELETE" &&
    pathParts.length === 4 &&
    pathParts[3] === "messages"
  ) {
    const conversation = getConversationById(conversationId);

    if (!conversation) {
      return Response.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    deleteMessages(conversationId);

    return Response.json({ success: true });
  }

  // GET /api/conversations/:id
  if (
    req.method === "GET" &&
    pathParts.length === 3
  ) {
    const conversation = getConversationById(conversationId);

    if (!conversation) {
      return Response.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    return Response.json({
      conversation,
      messages: getMessages(conversationId),
    });
  }

  // PATCH /api/conversations/:id
  if (
    req.method === "PATCH" &&
    pathParts.length === 3
  ) {
    const body = await req.json() as RenameBody;
    const title = body.title?.trim();

    if (!title) {
      return Response.json(
        { error: "A non-empty title is required." },
        { status: 400 },
      );
    }

    const conversation = renameConversation(
      conversationId,
      title.slice(0, 100),
    );

    if (!conversation) {
      return Response.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    return Response.json({ conversation });
  }

  // DELETE /api/conversations/:id
  if (
    req.method === "DELETE" &&
    pathParts.length === 3
  ) {
    const conversation = getConversationById(conversationId);

    if (!conversation) {
      return Response.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    deleteConversation(conversationId);

    return Response.json({ success: true });
  }

  return Response.json(
    { error: "Conversation route not found." },
    { status: 404 },
  );
}
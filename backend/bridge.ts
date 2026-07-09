import { handleChatApi } from "./api/chatApi.ts";
import { handleConversationApi } from "./api/conversationApi.ts";
import { getInstalledModels } from "./model/metadata.ts";

export async function handleBridgeRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  try {
    if (url.pathname === "/api/chat") {
      return handleChatApi(req);
    }

    if (url.pathname === "/api/models") {
      const models = await getInstalledModels();
      return Response.json({ models });
    }

    if (url.pathname.startsWith("/api/conversations")) {
      return handleConversationApi(req);
    }

    return Response.json(
      { error: "Route not found" },
      { status: 404 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";

    return Response.json(
      { error: message },
      { status: 500 },
    );
  }
}
import { runModel } from "./model/runner.ts";
import { getInstalledModels } from "./model/metadata.ts";

export async function handleBridgeRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  try {
    if (req.method === "GET" && url.pathname === "/api/models") {
      const models = await getInstalledModels();

      return Response.json({ models });
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      const body = await req.json();

      const reply = await runModel(body.messages, body.model);

      return Response.json({ reply });
    }

    return Response.json(
      { error: "Route not found" },
      { status: 404 },
    );
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Server error";

    return Response.json(
      { error: message },
      { status: 500 },
    );
  }
}
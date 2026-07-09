import { handleBridgeRequest } from "../backend/bridge.ts";
import "../backend/database/db.ts";
/// <reference lib="deno.window" />
/// <reference lib="deno.ns" />

declare const Deno: any;

const PORT = 8000;

Deno.serve({ port: PORT }, async (req: Request) => {
  const url = new URL(req.url);

  if (url.pathname.startsWith("/api")) {
    return handleBridgeRequest(req);
  }

  if (url.pathname.startsWith("/ui/")) {
    const filePath = "." + url.pathname;

    const contentType = filePath.endsWith(".js")
      ? "application/javascript"
      : "text/plain";

    return new Response(await Deno.readTextFile(filePath), {
      headers: {
        "content-type": contentType,
      },
    });
  }

  return new Response(await Deno.readTextFile("./ui/index.html"), {
    headers: {
      "content-type": "text/html",
    },
  });
});

console.log(`Local AI Playground running at http://localhost:${PORT}`);
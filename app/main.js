import { handleBridgeRequest } from "../backend/bridge.ts";

const PORT = 8000;

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);

  if (url.pathname.startsWith("/api")) {
    return handleBridgeRequest(req);
  }

  if (url.pathname.startsWith("/ui/")) {
    const filePath = "." + url.pathname;

    const contentType = filePath.endsWith(".ts")
      ? "application/typescript"
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
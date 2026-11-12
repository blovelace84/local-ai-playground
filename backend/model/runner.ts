const OLLAMA_URL = "http://localhost:11434/api/chat";
const DEFAULT_MODEL = "llama3.2";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type OllamaStreamChunk = {
  message?: { role?: string; content?: string };
  done?: boolean;
  error?: string;
};

export async function runModel(
  messages: ChatMessage[],
  model = DEFAULT_MODEL,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to connect to Ollama: ${response.status}`);
  }

  const data = await response.json();
  signal?.throwIfAborted();
  return data.message?.content ?? "No response from model.";
}

export async function streamModel(
  messages: ChatMessage[],
  model = DEFAULT_MODEL,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  signal?.throwIfAborted();

  const response = await fetch(OLLAMA_URL, {
  method: "POST",
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model,
    messages,
    stream: true,
  }),
  signal,
});

  if (!response.ok) {
    throw new Error(`Failed to connect to Ollama: ${response.status}`);
  }
  if (!response.body) {
    throw new Error("Ollama returned an empty response stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullResponse = "";
  let finished = false;

  function processLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    signal?.throwIfAborted();
    const data = JSON.parse(trimmed) as OllamaStreamChunk;
    if (data.error) throw new Error(data.error);
    const content = data.message?.content ?? "";
    if (content) {
      fullResponse += content;
      onChunk(content);
    }
    if (data.done === true) finished = true;
  }

  try {
    while (!finished) {
      signal?.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) processLine(line);
    }
    if (!finished) {
      buffer += decoder.decode();
      if (buffer.trim()) processLine(buffer);
    }
    signal?.throwIfAborted();
    if (!finished) throw new Error("Ollama stream ended before completion.");
    return fullResponse;
  } finally {
    if (!finished || signal?.aborted) {
      try { await reader.cancel(); } catch { /* Stream may already be closed. */ }
    }
    reader.releaseLock();
  }
}

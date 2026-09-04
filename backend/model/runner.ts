const OLLAMA_URL = "http://localhost:11434/api/chat";
const DEFAULT_MODEL = "llama3.2";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type OllamaStreamChunk = {
  message?: {
    role?: string;
    content?: string;
  };
  done?: boolean;
};

export async function runModel(
  messages: ChatMessage[],
  model = DEFAULT_MODEL,
): Promise<string> {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to connect to Ollama: ${response.status}`,
    );
  }

  const data = await response.json();

  return data.message?.content ?? "No response from model.";
}

export async function streamModel(
  messages: ChatMessage[],
  model = DEFAULT_MODEL,
  onChunk: (chunk: string) => void,
): Promise<string> {
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
  });

  if (!response.ok) {
    throw new Error(
      `Failed to connect to Ollama: ${response.status}`,
    );
  }

  if (!response.body) {
    throw new Error(
      "Ollama returned an empty response stream.",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let fullResponse = "";

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, {
        stream: true,
      });

      const lines = buffer.split("\n");

      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
          continue;
        }

        const data = JSON.parse(
          trimmedLine,
        ) as OllamaStreamChunk;

        const content = data.message?.content ?? "";

        if (content) {
          fullResponse += content;
          onChunk(content);
        }
      }
    }

    buffer += decoder.decode();

    const remainingLine = buffer.trim();

    if (remainingLine) {
      const data = JSON.parse(
        remainingLine,
      ) as OllamaStreamChunk;

      const content = data.message?.content ?? "";

      if (content) {
        fullResponse += content;
        onChunk(content);
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullResponse;
}
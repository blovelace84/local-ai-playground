const OLLAMA_URL = "http://localhost:11434/api/chat";
const DEFAULT_MODEL = "llama3.2";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function runModel(messages: ChatMessage[], model = DEFAULT_MODEL): Promise<string> {
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
    throw new Error("Failed to connect to Ollama");
  }

  const data = await response.json();
  return data.message?.content ?? "No response from model.";
}
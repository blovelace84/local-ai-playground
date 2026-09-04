export const chatService = {
  async sendMessage({
    conversationId,
    model,
    message,
    onStart,
    onChunk,
  }) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        conversationId,
        model,
        message,
      }),
    });

    if (!response.ok) {
      let errorMessage = "Chat request failed.";

      try {
        const data = await response.json();
        errorMessage = data.error ?? errorMessage;
      } catch {
        // Keep the default error message.
      }

      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error(
        "The server returned an empty response stream.",
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let fullResponse = "";
    let resolvedConversationId = conversationId;

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
          processLine(line);
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        processLine(buffer);
      }
    } finally {
      reader.releaseLock();
    }

    return {
      conversationId: resolvedConversationId,
      reply: fullResponse,
    };

    function processLine(line) {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        return;
      }

      const event = JSON.parse(trimmedLine);

      if (event.type === "start") {
        resolvedConversationId =
          event.conversationId ??
          resolvedConversationId;

        onStart?.({
          conversationId: resolvedConversationId,
        });

        return;
      }

      if (event.type === "chunk") {
        const content = event.content ?? "";

        fullResponse += content;

        onChunk?.(content);

        return;
      }

      if (event.type === "done") {
        resolvedConversationId =
          event.conversationId ??
          resolvedConversationId;

        return;
      }

      if (event.type === "error") {
        throw new Error(
          event.error ??
          "AI generation failed.",
        );
      }
    }
  },
};
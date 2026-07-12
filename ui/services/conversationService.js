async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Conversation request failed.");
  }

  return data;
}

export const conversationService = {
  async getAll() {
    const data = await requestJson("/api/conversations");
    return data.conversations;
  },

  async create() {
    const data = await requestJson("/api/conversations", {
      method: "POST",
      body: JSON.stringify({}),
    });

    return data.conversation;
  },

  async getById(id) {
    const data = await requestJson(
      `/api/conversations/${encodeURIComponent(id)}`,
    );

    return data;
  },

  async rename(id, title) {
    const data = await requestJson(
      `/api/conversations/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ title }),
      },
    );

    return data.conversation;
  },

  async delete(id) {
    await requestJson(
      `/api/conversations/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
      },
    );
  },

  async clearMessages(id) {
    await requestJson(
      `/api/conversations/${encodeURIComponent(id)}/messages`,
      {
        method: "DELETE",
      },
    );
  },
};
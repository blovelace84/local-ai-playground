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
        throw new Error(data.error ?? "Request failed.");
    }

    return data;
}

export const chatService = {
    async sendMessage({
        conversationId,
        model,
        message,
    }) {
        return await requestJson("/api/chat", {
            method: "POST",
            body: JSON.stringify({
                conversationId,
                model, 
                message,
            }),
        });
    },
};
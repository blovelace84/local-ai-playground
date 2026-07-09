export const chatStore = {
    conversations: [],
    activeConversationId: null,

    load() {
        const saved =
            localStorage.getItem("local-ai-conversations") ??
            localStorage.getItem("local-a-conversations");

        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.conversations = Array.isArray(parsed) ? parsed : [];
            } catch {
                this.conversations = [];
            }
        }

        if (this.conversations.length === 0) {
            this.createConversation();
        } else {
            this.activeConversationId = this.conversations[0].id;
        }
    },

    save() {
        localStorage.setItem(
            "local-ai-conversations",
            JSON.stringify(this.conversations),
        );
    },

    createConversation() {
        const conversation = {
            id: crypto.randomUUID(),
            title: "New Chat",
            messages: [],
            createdAt: new Date().toISOString(),
        };

        this.conversations.unshift(conversation);
        this.activeConversationId = conversation.id;
        this.save();
    },

    getActiveConversation() {
        return this.conversations.find(
            (chat) => chat.id === this.activeConversationId,
        );
    },

    addMessage(role, content) {
        const chat = this.getActiveConversation();
        if (!chat) return;

        chat.messages.push({ role, content });

        if (chat.title === "New Chat" && role === "user") {
            chat.title = content.slice(0, 30);
        }

        this.save();
    },

    setActiveConversation(id) {
        this.activeConversationId = id;
    },

    clearMessages() {
        const chat = this.getActiveConversation();
        if (!chat) return;

        chat.messages = [];
        chat.title = "New Chat";
        this.save();
    },

    getMessagesForOllama() {
        const chat = this.getActiveConversation();
        if (!chat) return [];

        return chat.messages.map((msg) => ({
            role: msg.role === "ai" ? "assistant" : "user",
            content: msg.content,
        }));
    },
};
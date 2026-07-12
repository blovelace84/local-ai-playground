import { conversationService } from "../services/conversationService.js";

export const chatStore = {
  conversations: [],
  activeConversationId: null,
  messages: [],
  initialized: false,

  async initialize() {
    this.conversations = await conversationService.getAll();

    if (this.conversations.length === 0) {
      const conversation = await conversationService.create();
      this.conversations = [conversation];
    }

    this.activeConversationId = this.conversations[0].id;
    await this.loadActiveConversation();

    this.initialized = true;
  },

  getActiveConversation() {
    return this.conversations.find(
      (conversation) =>
        conversation.id === this.activeConversationId,
    ) ?? null;
  },

  async refreshConversations() {
    this.conversations = await conversationService.getAll();
  },

  async loadActiveConversation() {
    if (!this.activeConversationId) {
      this.messages = [];
      return;
    }

    const data = await conversationService.getById(
      this.activeConversationId,
    );

    this.messages = data.messages ?? [];
  },

  async selectConversation(id) {
    this.activeConversationId = id;
    await this.loadActiveConversation();
  },

  async createConversation() {
    const conversation = await conversationService.create();

    await this.refreshConversations();

    this.activeConversationId = conversation.id;
    this.messages = [];

    return conversation;
  },

  async renameConversation(id, title) {
    await conversationService.rename(id, title);
    await this.refreshConversations();
  },

  async deleteConversation(id) {
    await conversationService.delete(id);
    await this.refreshConversations();

    if (this.conversations.length === 0) {
      await this.createConversation();
      return;
    }

    if (this.activeConversationId === id) {
      this.activeConversationId = this.conversations[0].id;
    }

    await this.loadActiveConversation();
  },

  async clearActiveConversation() {
    if (!this.activeConversationId) return;

    await conversationService.clearMessages(
      this.activeConversationId,
    );

    this.messages = [];
  },

  addTemporaryMessage(role, content) {
    this.messages.push({
      id: crypto.randomUUID(),
      conversationId: this.activeConversationId,
      role,
      content,
      createdAt: new Date().toISOString(),
    });
  },
};
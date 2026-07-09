import { sqliteTable, text } from "npm:drizzle-orm/sqlite-core";

export const conversations = sqliteTable("conversations", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull(),
});


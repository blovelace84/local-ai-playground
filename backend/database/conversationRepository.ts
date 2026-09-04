import { db } from "./db.ts";

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

function mapConversation(row: Record<string, unknown>): Conversation {
  return {
    id: String(row.id),
    title: String(row.title),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function createConversation(title = "New Chat"): Conversation {
  const now = new Date().toISOString();
  const conversation: Conversation = {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(`
    INSERT INTO conversations (id, title, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(
    conversation.id,
    conversation.title,
    conversation.createdAt,
    conversation.updatedAt,
  );

  return conversation;
}

export function getAllConversations(): Conversation[] {
  const rows = db.prepare(`
    SELECT id, title, created_at, updated_at
    FROM conversations
    ORDER BY updated_at DESC
  `).all();

  return rows.map(mapConversation);
}

export function getConversationById(id: string): Conversation | null {
  const row = db.prepare(`
    SELECT id, title, created_at, updated_at
    FROM conversations
    WHERE id = ?
  `).get(id);

  return row ? mapConversation(row) : null;
}

export function renameConversation(id: string, title: string): Conversation | null {
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE conversations
    SET title = ?, updated_at = ?
    WHERE id = ?
  `).run(title, now, id);

  return getConversationById(id);
}

export function touchConversation(id: string): void {
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE conversations
    SET updated_at = ?
    WHERE id = ?
  `).run(now, id);
}

export function deleteConversation(id: string): void {
  db.prepare(`
    DELETE FROM messages
    WHERE conversation_id = ?
  `).run(id);

  db.prepare(`
    DELETE FROM conversations
    WHERE id = ?
  `).run(id);
}
import { db } from "./db.ts";
import { touchConversation } from "./conversationRepository.ts";

export type Message = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

function mapMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    role: String(row.role) as "user" | "assistant",
    content: String(row.content),
    createdAt: String(row.created_at),
  };
}

export function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
): Message {

  const message: Message = {
    id: crypto.randomUUID(),
    conversationId,
    role,
    content,
    createdAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO messages
    (
      id,
      conversation_id,
      role,
      content,
      created_at
    )
    VALUES
    (
      ?, ?, ?, ?, ?
    )
  `).run(
    message.id,
    message.conversationId,
    message.role,
    message.content,
    message.createdAt,
  );

  touchConversation(conversationId);

  return message;
}

export function getMessages(
  conversationId: string,
): Message[] {

  const rows = db.prepare(`
    SELECT
      id,
      conversation_id,
      role,
      content,
      created_at
    FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
  `).all(conversationId);

  return rows.map(mapMessage);
}

export function deleteMessages(
  conversationId: string,
) {

  db.prepare(`
    DELETE FROM messages
    WHERE conversation_id = ?
  `).run(conversationId);

}
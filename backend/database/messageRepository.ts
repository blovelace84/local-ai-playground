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
      (id, conversation_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?)
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
    SELECT id, conversation_id, role, content, created_at
    FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC, rowid ASC
  `).all(conversationId);

  return rows.map(mapMessage);
}

export function replaceAssistantMessage(
  conversationId: string,
  messageId: string,
  content: string,
): void {
  const latest = getMessages(conversationId).at(-1);

  if (
    !latest ||
    latest.id !== messageId ||
    latest.role !== "assistant"
  ) {
    throw new Error(
      "The response is no longer the latest assistant message.",
    );
  }

  db.prepare(`
    UPDATE messages
    SET content = ?
    WHERE id = ?
      AND conversation_id = ?
      AND role = 'assistant'
  `).run(content, messageId, conversationId);

  touchConversation(conversationId);
}

export function replaceQuestionAndAnswer(
  conversationId: string,
  userMessageId: string,
  assistantMessageId: string,
  newQuestion: string,
  newAnswer: string,
): void {
  const question = newQuestion.trim();

  if (!question || !newAnswer.trim()) {
    throw new Error("Question and answer cannot be empty.");
  }

  // A transaction prevents partially saved edits.
  db.exec("BEGIN IMMEDIATE");

  try {
    const messages = getMessages(conversationId);
    const latest = messages.at(-1);
    const previous = messages.at(-2);

    if (
      !latest ||
      !previous ||
      latest.id !== assistantMessageId ||
      latest.role !== "assistant" ||
      previous.id !== userMessageId ||
      previous.role !== "user"
    ) {
      throw new Error(
        "Only the latest question and answer can be edited.",
      );
    }

    db.prepare(`
      UPDATE messages
      SET content = ?
      WHERE id = ?
        AND conversation_id = ?
        AND role = 'user'
    `).run(question, userMessageId, conversationId);

    db.prepare(`
      UPDATE messages
      SET content = ?
      WHERE id = ?
        AND conversation_id = ?
        AND role = 'assistant'
    `).run(newAnswer, assistantMessageId, conversationId);

    touchConversation(conversationId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function deleteMessages(
  conversationId: string,
): void {
  db.prepare(`
    DELETE FROM messages
    WHERE conversation_id = ?
  `).run(conversationId);
  touchConversation(conversationId);
}

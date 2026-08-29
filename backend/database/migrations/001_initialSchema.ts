import type { Migration } from "./migrationTypes.ts";

export const initialSchemaMigration: Migration = {
  version: 1,

  name: "initial_schema",

  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,

        FOREIGN KEY (conversation_id)
          REFERENCES conversations(id)
          ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS
        idx_conversations_updated_at
      ON conversations(updated_at);

      CREATE INDEX IF NOT EXISTS
        idx_messages_conversation_id
      ON messages(conversation_id);

      CREATE INDEX IF NOT EXISTS
        idx_messages_created_at
      ON messages(created_at);
    `);
  },
};
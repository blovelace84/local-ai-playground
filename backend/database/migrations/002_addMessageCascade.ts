import type { Migration } from "./migrationTypes.ts";

export const addMessageCascadeMigration: Migration = {
  version: 2,

  name: "add_message_delete_cascade",

  up(db) {
    db.exec(`
      CREATE TABLE messages_new (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,

        FOREIGN KEY (conversation_id)
          REFERENCES conversations(id)
          ON DELETE CASCADE
      );

      INSERT INTO messages_new (
        id,
        conversation_id,
        role,
        content,
        created_at
      )
      SELECT
        id,
        conversation_id,
        role,
        content,
        created_at
      FROM messages;

      DROP TABLE messages;

      ALTER TABLE messages_new
      RENAME TO messages;

      CREATE INDEX IF NOT EXISTS
        idx_messages_conversation_id
      ON messages(conversation_id);

      CREATE INDEX IF NOT EXISTS
        idx_messages_created_at
      ON messages(created_at);
    `);
  },
};
import { Database } from "@db/sqlite";
import { runMigrations } from "./migrations/index.ts";

await Deno.mkdir("./data", { recursive: true });

export const db = new Database(
  "./data/local-ai-playground.db",
);

// Recommended SQLite settings.
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
`);

runMigrations(db);

console.log("SQLite database ready.");
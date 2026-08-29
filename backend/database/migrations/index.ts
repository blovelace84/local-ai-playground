import type { Database } from "@db/sqlite";
import type { Migration } from "./migrationTypes.ts";
import { initialSchemaMigration } from "./001_initialSchema.ts";
import { addMessageCascadeMigration } from "./002_addMessageCascade.ts";

const migrations: Migration[] = [
  initialSchemaMigration,
  addMessageCascadeMigration,
];

export function runMigrations(db: Database): void {
  createMigrationsTable(db);

  const appliedVersions = getAppliedMigrationVersions(db);

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    console.log(
      `Running migration ${migration.version}: ${migration.name}`,
    );

    db.transaction(() => {
      migration.up(db);

      db.prepare(`
        INSERT INTO schema_migrations (
          version,
          name,
          applied_at
        )
        VALUES (?, ?, ?)
      `).run(
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
    });

    console.log(
      `Migration ${migration.version} completed.`,
    );
  }
}

function createMigrationsTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

function getAppliedMigrationVersions(
  db: Database,
): Set<number> {
  const rows = db.prepare(`
    SELECT version
    FROM schema_migrations
    ORDER BY version ASC
  `).all() as Array<{ version: number }>;

  return new Set(
    rows.map((row) => Number(row.version)),
  );
}
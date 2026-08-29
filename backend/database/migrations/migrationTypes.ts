import type { Database } from "@db/sqlite";

export type Migration = {
    version: number;
    name: string;
    up: (db: Database) => void;
};
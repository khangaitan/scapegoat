import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema/index.js";
import { resolve, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dbPath = process.env.SQLITE_PATH ?? resolve(dirname(fileURLToPath(import.meta.url)), "../data/songolt.db");
mkdirSync(dirname(dbPath), { recursive: true });
const sqlite = new Database(dbPath);
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS host_codes (
    code TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    note TEXT,
    used_at TEXT,
    used_by_name TEXT,
    room_id TEXT
  )
`);

export const db = drizzle(sqlite, { schema });
export * from "./schema/index.js";

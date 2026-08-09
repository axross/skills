import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Opens (creating if needed) the SQLite file at `path` and wraps it in a
 * Drizzle client. `:memory:` skips the directory setup and the WAL pragma —
 * neither means anything for an in-memory database, and better-sqlite3
 * leaves WAL mode alone rather than erroring when it's asked for one.
 */
export function createDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

  const sqlite = new Database(path);
  if (path !== ":memory:") sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return drizzle(sqlite, { schema });
}

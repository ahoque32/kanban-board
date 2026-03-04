import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const configuredPath = process.env.DATABASE_URL || "./drizzle/kanban.db";
const dbPath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.join(process.cwd(), configuredPath);

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

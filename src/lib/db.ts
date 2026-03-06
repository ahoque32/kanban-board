import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

let _sqlite: InstanceType<typeof Database> | null = null;
let _db: BetterSQLite3Database | null = null;

function init() {
  if (_sqlite && _db) return { sqlite: _sqlite, db: _db };

  const configuredPath =
    process.env.DATABASE_URL ||
    (process.env.NODE_ENV === "production" ? "/app/data/kanban.db" : "./drizzle/kanban.db");

  const dbPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(process.cwd(), configuredPath);

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  _sqlite = new Database(dbPath);
  // Use DELETE journal mode for GCS FUSE compatibility (WAL requires shared memory)
  const isGcsFuse = dbPath.startsWith("/app/data") && process.env.NODE_ENV === "production";
  _sqlite.pragma(isGcsFuse ? "journal_mode = DELETE" : "journal_mode = WAL");
  if (isGcsFuse) {
    _sqlite.pragma("synchronous = FULL");
  }
  _db = drizzle(_sqlite);

  return { sqlite: _sqlite, db: _db };
}

export const getSqlite = () => init().sqlite;
export const getDb = () => init().db;

// For backward compat — lazy getters
export const sqlite = new Proxy({} as InstanceType<typeof Database>, {
  get(_, prop: string | symbol) {
    const target = getSqlite();
    const value = Reflect.get(target, prop);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

export const db = new Proxy({} as BetterSQLite3Database, {
  get(_, prop: string | symbol) {
    const target = getDb();
    const value = Reflect.get(target, prop);
    return typeof value === "function" ? value.bind(target) : value;
  },
});

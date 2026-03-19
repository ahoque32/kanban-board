import bcrypt from "bcryptjs";
import { count, eq } from "drizzle-orm";
import { db, sqlite } from "@/lib/db";
import { boards, cards, columns, settings, assignees, DEFAULT_ASSIGNEES, users } from "@/lib/schema";

let initialized = false;

const ADMIN_EMAIL = "admin@renderwise.net";
const ADMIN_PASSWORD = "admin123";
const ADMIN_NAME = "Ahawk";

function hasColumn(table: string, columnName: string) {
  const tableInfo = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return tableInfo.some((column) => column.name === columnName);
}

export async function ensureDbInitialized() {
  if (initialized) return;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS columns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL,
      column_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      assignee TEXT NOT NULL DEFAULT '',
      due_date TEXT,
      priority TEXT NOT NULL DEFAULT 'med',
      labels TEXT NOT NULL DEFAULT '[]',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY,
      discord_webhook_url TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assignees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignee TEXT NOT NULL,
      webhook_url TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (!hasColumn("cards", "created_by")) {
    sqlite.exec("ALTER TABLE cards ADD COLUMN created_by INTEGER;");
  }

  const [existingBoard] = await db.select({ value: count() }).from(boards);
  if ((existingBoard?.value ?? 0) === 0) {
    const boardInsert = await db.insert(boards).values({ name: "KanbanFlow" }).returning();
    const boardId = boardInsert[0].id;

    await db.insert(columns).values([
      { boardId, name: "To Do", position: 0 },
      { boardId, name: "In Progress", position: 1 },
      { boardId, name: "Done", position: 2 },
    ]);

    const [todoColumn] = await db
      .select()
      .from(columns)
      .where(eq(columns.boardId, boardId))
      .orderBy(columns.position)
      .limit(1);

    if (todoColumn) {
      await db.insert(cards).values({
        boardId,
        columnId: todoColumn.id,
        title: "Welcome to KanbanFlow",
        description: "Create, drag, and organize tasks.",
        assignee: "Ahawk",
        priority: "med",
        labels: JSON.stringify(["welcome"]),
        position: 0,
      });
    }
  }

  // Seed default assignees
  const [existingAssignees] = await db.select({ value: count() }).from(assignees);
  if ((existingAssignees?.value ?? 0) === 0) {
    for (const name of DEFAULT_ASSIGNEES) {
      await db.insert(assignees).values({ name }).onConflictDoNothing();
    }
  }

  const [existingSettings] = await db.select({ value: count() }).from(settings);
  if ((existingSettings?.value ?? 0) === 0) {
    await db.insert(settings).values({ id: 1, discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL ?? null });
  }

  const adminPasswordHash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
  await db
    .insert(users)
    .values({
      email: ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      name: ADMIN_NAME,
      role: "admin",
    })
    .onConflictDoNothing();

  // Migrate admin email if it was changed (e.g. from ahawkhoque@gmail.com)
  const [adminUser] = await db.select().from(users).where(eq(users.name, ADMIN_NAME)).limit(1);
  if (adminUser && adminUser.email !== ADMIN_EMAIL) {
    await db.update(users).set({ email: ADMIN_EMAIL }).where(eq(users.id, adminUser.id));
  }

  // Auto-cleanup: delete tasks in "Done" column for 60+ hours
  cleanupDoneTasks();

  initialized = true;
}

let lastCleanup = 0;
function cleanupDoneTasks() {
  const now = Date.now();
  // Only run cleanup once per hour
  if (now - lastCleanup < 3600000) return;
  lastCleanup = now;

  try {
    const allCols = db.select().from(columns).all();
    const doneCols = allCols.filter((c) => c.name.toLowerCase() === "done");
    if (doneCols.length === 0) return;

    const doneColIds = doneCols.map((c) => c.id);
    const allCards = db.select().from(cards).all();
    const cutoff = new Date(now - 60 * 60 * 60 * 1000).toISOString(); // 60 hours ago

    for (const card of allCards) {
      if (doneColIds.includes(card.columnId) && card.updatedAt < cutoff) {
        db.delete(cards).where(eq(cards.id, card.id)).run();
      }
    }
  } catch {
    // Silently ignore cleanup errors
  }
}

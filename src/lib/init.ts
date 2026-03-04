import { count, eq } from "drizzle-orm";
import { db, sqlite } from "@/lib/db";
import { boards, cards, columns, settings } from "@/lib/schema";

let initialized = false;

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
  `);

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

  const [existingSettings] = await db.select({ value: count() }).from(settings);
  if ((existingSettings?.value ?? 0) === 0) {
    await db.insert(settings).values({ id: 1, discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL ?? null });
  }

  initialized = true;
}

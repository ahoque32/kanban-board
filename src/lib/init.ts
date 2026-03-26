import bcrypt from "bcryptjs";
import { count, eq, isNull } from "drizzle-orm";
import { db, sqlite } from "@/lib/db";
import { boards, cards, columns, settings, assignees, DEFAULT_ASSIGNEES, uploadQueue, users } from "@/lib/schema";

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

    CREATE TABLE IF NOT EXISTS column_visibility (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      column_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      UNIQUE(column_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS invite_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS upload_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      drive_link TEXT,
      notes TEXT NOT NULL DEFAULT '',
      created_by INTEGER,
      webhook_fired INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (!hasColumn("cards", "created_by")) {
    sqlite.exec("ALTER TABLE cards ADD COLUMN created_by INTEGER;");
  }

  if (!hasColumn("settings", "assign_mode")) {
    sqlite.exec("ALTER TABLE settings ADD COLUMN assign_mode TEXT NOT NULL DEFAULT 'restricted';");
  }

  if (!hasColumn("users", "assign_mode")) {
    sqlite.exec("ALTER TABLE users ADD COLUMN assign_mode TEXT NOT NULL DEFAULT 'restricted';");
  }

  if (!hasColumn("upload_queue", "drive_link")) {
    sqlite.exec("ALTER TABLE upload_queue ADD COLUMN drive_link TEXT;");
  }

  if (!hasColumn("upload_queue", "notes")) {
    sqlite.exec("ALTER TABLE upload_queue ADD COLUMN notes TEXT NOT NULL DEFAULT '';");
  }

  if (!hasColumn("upload_queue", "created_by")) {
    sqlite.exec("ALTER TABLE upload_queue ADD COLUMN created_by INTEGER;");
  }

  if (!hasColumn("upload_queue", "webhook_fired")) {
    sqlite.exec("ALTER TABLE upload_queue ADD COLUMN webhook_fired INTEGER NOT NULL DEFAULT 0;");
  }

  if (!hasColumn("upload_queue", "updated_at")) {
    sqlite.exec("ALTER TABLE upload_queue ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;");
  }

  // Backfill null createdBy to admin user
  const nullCreatedByCards = db.select({ id: cards.id }).from(cards).where(isNull(cards.createdBy)).all();
  if (nullCreatedByCards.length > 0) {
    const [admin] = db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1).all();
    if (admin) {
      sqlite.exec(`UPDATE cards SET created_by = ${admin.id} WHERE created_by IS NULL;`);
    }
  }

  const nullCreatedByUploads = db.select({ id: uploadQueue.id }).from(uploadQueue).where(isNull(uploadQueue.createdBy)).all();
  if (nullCreatedByUploads.length > 0) {
    const [admin] = db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1).all();
    if (admin) {
      sqlite.exec(`UPDATE upload_queue SET created_by = ${admin.id} WHERE created_by IS NULL;`);
    }
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

  // Ensure admin user exists with correct email
  const adminPasswordHash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
  const [existingAdmin] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);

  if (!existingAdmin) {
    // Fresh DB — create admin user
    await db.insert(users).values({
      email: ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      name: ADMIN_NAME,
      role: "admin",
    });
  } else if (existingAdmin.email !== ADMIN_EMAIL) {
    // Admin exists with old email — delete any duplicate with the new email first, then update
    const [duplicate] = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL)).limit(1);
    if (duplicate) {
      await db.delete(users).where(eq(users.id, duplicate.id));
    }
    await db.update(users).set({ email: ADMIN_EMAIL }).where(eq(users.id, existingAdmin.id));
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

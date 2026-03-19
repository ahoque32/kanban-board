import { asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { ensureDbInitialized } from "@/lib/init";
import { cardVisibilityCondition } from "@/lib/permissions";
import { boards, cards, columns, users } from "@/lib/schema";

function parseLabels(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAuth(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const board = await db.select().from(boards).limit(1);
  if (!board[0]) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const cardQuery = db.select().from(cards).orderBy(asc(cards.position), asc(cards.id));
  const visibility = cardVisibilityCondition(auth.user);

  const [allColumns, visibleCards] = await Promise.all([
    db.select().from(columns).orderBy(asc(columns.position)),
    visibility ? cardQuery.where(visibility) : cardQuery,
  ]);

  // Resolve createdBy IDs to names
  const allUsers = db.select({ id: users.id, name: users.name }).from(users).all();
  const userMap: Record<number, string> = {};
  for (const u of allUsers) userMap[u.id] = u.name;

  return NextResponse.json({
    board: {
      id: board[0].id,
      name: board[0].name,
      createdAt: board[0].createdAt,
      updatedAt: board[0].updatedAt,
    },
    columns: allColumns.map((column) => ({
      id: column.id,
      boardId: column.boardId,
      name: column.name,
      position: column.position,
      createdAt: column.createdAt,
    })),
    cards: visibleCards.map((card) => ({
      id: card.id,
      boardId: card.boardId,
      columnId: card.columnId,
      title: card.title,
      description: card.description,
      assignee: card.assignee,
      dueDate: card.dueDate,
      priority: card.priority,
      labels: parseLabels(card.labels),
      position: card.position,
      createdBy: card.createdBy,
      createdByName: card.createdBy ? (userMap[card.createdBy] || "Unknown") : null,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAdmin(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const name = (body.name || "KanbanFlow").toString().trim();
  if (!name) {
    return NextResponse.json({ error: "Board name is required" }, { status: 400 });
  }

  const created = await db.insert(boards).values({ name }).returning();
  const boardId = created[0].id;

  await db.insert(columns).values([
    { boardId, name: "To Do", position: 0 },
    { boardId, name: "In Progress", position: 1 },
    { boardId, name: "Done", position: 2 },
  ]);

  return NextResponse.json({ board: created[0] }, { status: 201 });
}

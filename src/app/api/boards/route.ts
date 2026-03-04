import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/init";
import { boards, cards, columns } from "@/lib/schema";

function parseLabels(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET() {
  await ensureDbInitialized();

  const board = await db.select().from(boards).limit(1);
  if (!board[0]) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const [allColumns, allCards] = await Promise.all([
    db.select().from(columns).orderBy(asc(columns.position)),
    db.select().from(cards).orderBy(asc(cards.position), asc(cards.id)),
  ]);

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
    cards: allCards.map((card) => ({
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
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    })),
  });
}

export async function POST(request: Request) {
  await ensureDbInitialized();
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

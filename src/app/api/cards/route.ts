import { asc, eq, max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDiscordTaskNotification } from "@/lib/discord";
import { ensureDbInitialized } from "@/lib/init";
import { cards, columns, priorities } from "@/lib/schema";

function safeLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => value?.toString().trim())
    .filter((value): value is string => Boolean(value));
}

export async function GET() {
  await ensureDbInitialized();
  const list = await db.select().from(cards).orderBy(asc(cards.position), asc(cards.id));
  return NextResponse.json({
    cards: list.map((card) => ({
      ...card,
      labels: JSON.parse(card.labels || "[]"),
    })),
  });
}

export async function POST(request: Request) {
  await ensureDbInitialized();
  const body = await request.json();

  const title = (body.title || "").toString().trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const boardId = Number(body.boardId ?? 1);
  const columnId = Number(body.columnId);
  const priority = priorities.includes(body.priority) ? body.priority : "med";

  const [maxPosition] = await db.select({ value: max(cards.position) }).from(cards).where(eq(cards.columnId, columnId));

  const created = await db
    .insert(cards)
    .values({
      boardId,
      columnId,
      title,
      description: (body.description || "").toString(),
      assignee: (body.assignee || "").toString(),
      dueDate: body.dueDate ? body.dueDate.toString() : null,
      priority,
      labels: JSON.stringify(safeLabels(body.labels)),
      position: (maxPosition?.value ?? -1) + 1,
      updatedAt: new Date().toISOString(),
    })
    .returning();

  const column = await db.select().from(columns).where(eq(columns.id, columnId)).limit(1);

  await sendDiscordTaskNotification("created", {
    title: created[0].title,
    assignee: created[0].assignee,
    toColumn: column[0]?.name || "Unknown",
  });

  return NextResponse.json(
    {
      card: {
        ...created[0],
        labels: JSON.parse(created[0].labels || "[]"),
      },
    },
    { status: 201 },
  );
}

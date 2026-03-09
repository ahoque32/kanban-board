import { and, asc, eq, max } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { sendDiscordTaskNotification } from "@/lib/discord";
import { ensureDbInitialized } from "@/lib/init";
import { cardVisibilityCondition } from "@/lib/permissions";
import { cards, columns, priorities } from "@/lib/schema";

function safeLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => value?.toString().trim())
    .filter((value): value is string => Boolean(value));
}

export async function GET(request: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAuth(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const visibility = cardVisibilityCondition(auth.user);
  const query = db.select().from(cards).orderBy(asc(cards.position), asc(cards.id));
  const list = visibility ? await query.where(visibility) : await query;

  return NextResponse.json({
    cards: list.map((card) => ({
      ...card,
      labels: JSON.parse(card.labels || "[]"),
    })),
  });
}

export async function POST(request: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAuth(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const title = (body.title || "").toString().trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const boardId = Number(body.boardId ?? 1);
  const columnId = Number(body.columnId);
  const priority = priorities.includes(body.priority) ? body.priority : "med";

  if (!columnId || Number.isNaN(columnId)) {
    return NextResponse.json({ error: "Valid columnId is required" }, { status: 400 });
  }

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
      createdBy: auth.user.id,
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

import { and, eq, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { sendDiscordTaskNotification } from "@/lib/discord";
import { ensureDbInitialized } from "@/lib/init";
import { cards, columns, priorities } from "@/lib/schema";

function normalizeLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => value?.toString().trim())
    .filter((value): value is string => Boolean(value));
}

type Params = {
  params: Promise<{ id: string }>;
};

function userCardScope(user: { id: number; role: "admin" | "user"; name: string }, cardId: number) {
  if (user.role === "admin") {
    return eq(cards.id, cardId);
  }

  return and(eq(cards.id, cardId), or(eq(cards.createdBy, user.id), eq(cards.assignee, user.name)));
}

export async function PATCH(request: NextRequest, { params }: Params) {
  await ensureDbInitialized();

  const auth = requireAuth(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const cardId = Number(id);

  if (Number.isNaN(cardId)) {
    return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
  }

  const body = await request.json();
  const scope = userCardScope(auth.user, cardId);
  const existing = await db.select().from(cards).where(scope).limit(1);

  if (!existing[0]) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const oldCard = existing[0];
  const updates: {
    title?: string;
    description?: string;
    assignee?: string;
    dueDate?: string | null;
    priority?: "low" | "med" | "high";
    labels?: string;
    columnId?: number;
    position?: number;
    updatedAt: string;
  } = {
    updatedAt: new Date().toISOString(),
  };

  if (typeof body.title === "string") updates.title = body.title.trim();
  if (typeof body.description === "string") updates.description = body.description;
  if (typeof body.assignee === "string") updates.assignee = body.assignee;
  if (typeof body.dueDate === "string" || body.dueDate === null) updates.dueDate = body.dueDate;
  if (priorities.includes(body.priority)) updates.priority = body.priority;
  if (Array.isArray(body.labels)) updates.labels = JSON.stringify(normalizeLabels(body.labels));
  if (typeof body.columnId === "number") updates.columnId = body.columnId;
  if (typeof body.position === "number") updates.position = body.position;

  const updated = await db.update(cards).set(updates).where(eq(cards.id, cardId)).returning();
  const nextCard = updated[0];

  if (!nextCard) {
    return NextResponse.json({ error: "Card update failed" }, { status: 500 });
  }

  const moved = typeof updates.columnId === "number" && updates.columnId !== oldCard.columnId;
  if (moved) {
    const [fromColumn, toColumn] = await Promise.all([
      db.select().from(columns).where(eq(columns.id, oldCard.columnId)).limit(1),
      db.select().from(columns).where(eq(columns.id, nextCard.columnId)).limit(1),
    ]);

    const toName = toColumn[0]?.name || "Unknown";
    await sendDiscordTaskNotification("moved", {
      title: nextCard.title,
      assignee: nextCard.assignee,
      fromColumn: fromColumn[0]?.name || "Unknown",
      toColumn: toName,
    });

    if (toName.toLowerCase() === "done") {
      await sendDiscordTaskNotification("completed", {
        title: nextCard.title,
        assignee: nextCard.assignee,
        toColumn: toName,
      });
    }
  }

  return NextResponse.json({
    card: {
      ...nextCard,
      labels: JSON.parse(nextCard.labels || "[]"),
    },
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  await ensureDbInitialized();

  const auth = requireAuth(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const cardId = Number(id);

  if (Number.isNaN(cardId)) {
    return NextResponse.json({ error: "Invalid card id" }, { status: 400 });
  }

  const scope = userCardScope(auth.user, cardId);
  const existing = await db.select({ id: cards.id }).from(cards).where(scope).limit(1);
  if (!existing[0]) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  await db.delete(cards).where(eq(cards.id, cardId));
  return NextResponse.json({ ok: true });
}

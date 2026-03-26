import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendDiscordVideoReadyNotification } from "@/lib/discord";
import { ensureDbInitialized } from "@/lib/init";
import { uploadQueue, users } from "@/lib/schema";

type Params = {
  params: Promise<{ id: string }>;
};

const VALID_STATUSES = new Set(["pending", "ready", "uploaded"]);

function normalizeItem(
  item: typeof uploadQueue.$inferSelect,
  creatorMap: Record<number, string>,
) {
  return {
    ...item,
    creatorName: item.createdBy ? (creatorMap[item.createdBy] || "Unknown") : null,
  };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  await ensureDbInitialized();

  const auth = requireAuth(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const itemId = Number(id);

  if (Number.isNaN(itemId)) {
    return NextResponse.json({ error: "Invalid upload queue id" }, { status: 400 });
  }

  const [existing] = await db.select().from(uploadQueue).where(eq(uploadQueue.id, itemId)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Upload queue item not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: Partial<typeof uploadQueue.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    updates.title = title;
  }

  if (typeof body.date === "string") {
    const date = body.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Date must be YYYY-MM-DD" }, { status: 400 });
    }
    updates.date = date;
  }

  if (typeof body.notes === "string") {
    updates.notes = body.notes.trim();
  }

  if (typeof body.driveLink === "string" || body.driveLink === null) {
    updates.driveLink = typeof body.driveLink === "string" && body.driveLink.trim() ? body.driveLink.trim() : null;
  }

  let requestedStatus: "pending" | "ready" | "uploaded" | null = null;
  if (typeof body.status === "string") {
    if (!VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    requestedStatus = body.status as "pending" | "ready" | "uploaded";
    updates.status = requestedStatus;
  }

  const shouldFireWebhook = (requestedStatus === "ready" || requestedStatus === "uploaded") && existing.webhookFired === 0;
  if (shouldFireWebhook) {
    try {
      await sendDiscordVideoReadyNotification({
        title: updates.title ?? existing.title,
        date: updates.date ?? existing.date,
        notes: updates.notes ?? existing.notes,
        driveLink: updates.driveLink ?? existing.driveLink,
      });
      updates.webhookFired = 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send Discord webhook";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const [updated] = await db.update(uploadQueue).set(updates).where(eq(uploadQueue.id, itemId)).returning();
  const creators = await db.select({ id: users.id, name: users.name }).from(users);
  const creatorMap = Object.fromEntries(creators.map((creator) => [creator.id, creator.name]));

  return NextResponse.json({ item: normalizeItem(updated, creatorMap) });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  await ensureDbInitialized();

  const auth = requireAdmin(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const itemId = Number(id);

  if (Number.isNaN(itemId)) {
    return NextResponse.json({ error: "Invalid upload queue id" }, { status: 400 });
  }

  const [existing] = await db.select({ id: uploadQueue.id }).from(uploadQueue).where(eq(uploadQueue.id, itemId)).limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Upload queue item not found" }, { status: 404 });
  }

  await db.delete(uploadQueue).where(eq(uploadQueue.id, itemId));
  return NextResponse.json({ ok: true });
}

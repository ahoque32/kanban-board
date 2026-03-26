import { desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/init";
import { uploadQueue, users } from "@/lib/schema";

function normalizeItem(
  item: typeof uploadQueue.$inferSelect,
  creatorMap: Record<number, string>,
) {
  return {
    ...item,
    creatorName: item.createdBy ? (creatorMap[item.createdBy] || "Unknown") : null,
  };
}

export async function GET(request: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAuth(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await db.select().from(uploadQueue).orderBy(desc(uploadQueue.date), desc(uploadQueue.id));
  const creators = await db.select({ id: users.id, name: users.name }).from(users);
  const creatorMap = Object.fromEntries(creators.map((creator) => [creator.id, creator.name]));

  return NextResponse.json({
    items: items.map((item) => normalizeItem(item, creatorMap)),
  });
}

export async function POST(request: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAdmin(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const title = (body.title || "").toString().trim();
  const date = (body.date || "").toString().trim();
  const driveLink = typeof body.driveLink === "string" ? body.driveLink.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Date must be YYYY-MM-DD" }, { status: 400 });
  }

  const [item] = await db
    .insert(uploadQueue)
    .values({
      title,
      date,
      status: "pending",
      driveLink: driveLink || null,
      notes,
      createdBy: auth.user.id,
      updatedAt: new Date().toISOString(),
    })
    .returning();

  return NextResponse.json(
    {
      item: {
        ...item,
        creatorName: auth.user.name,
      },
    },
    { status: 201 },
  );
}

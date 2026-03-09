import { asc, eq, max } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { ensureDbInitialized } from "@/lib/init";
import { columns } from "@/lib/schema";

export async function GET(request: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAuth(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = await db.select().from(columns).orderBy(asc(columns.position));
  return NextResponse.json({ columns: list });
}

export async function POST(request: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAdmin(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  const name = (body.name || "").toString().trim();
  const boardId = Number(body.boardId ?? 1);
  if (!name) {
    return NextResponse.json({ error: "Column name is required" }, { status: 400 });
  }

  const [positionRow] = await db
    .select({ maxPosition: max(columns.position) })
    .from(columns)
    .where(eq(columns.boardId, boardId));

  const created = await db
    .insert(columns)
    .values({
      boardId,
      name,
      position: (positionRow?.maxPosition ?? -1) + 1,
    })
    .returning();

  return NextResponse.json({ column: created[0] }, { status: 201 });
}

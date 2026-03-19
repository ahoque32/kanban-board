import { asc, eq, max, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { ensureDbInitialized } from "@/lib/init";
import { columns, columnVisibility, users } from "@/lib/schema";

export async function GET(request: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAuth(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allColumns = await db.select().from(columns).orderBy(asc(columns.position));

  // Admins see all columns
  if (auth.user.role === "admin") {
    // Attach visibility info for admin UI
    const visibility = db.select().from(columnVisibility).all();
    const visMap: Record<number, number[]> = {};
    for (const v of visibility) {
      (visMap[v.columnId] ||= []).push(v.userId);
    }
    return NextResponse.json({
      columns: allColumns.map((c) => ({ ...c, visibleTo: visMap[c.id] || [] })),
    });
  }

  // Non-admins: only see columns they have access to
  const myVisibility = db
    .select({ columnId: columnVisibility.columnId })
    .from(columnVisibility)
    .where(eq(columnVisibility.userId, auth.user.id))
    .all();

  // If a column has NO visibility entries, it's visible to everyone (default open)
  // If it HAS entries, only those users can see it
  const restrictedColumnIds = new Set(
    db.select({ columnId: columnVisibility.columnId }).from(columnVisibility).all().map((v) => v.columnId)
  );
  const myColumnIds = new Set(myVisibility.map((v) => v.columnId));

  const visibleColumns = allColumns.filter((col) => {
    if (!restrictedColumnIds.has(col.id)) return true; // no restrictions = visible to all
    return myColumnIds.has(col.id); // restricted = check if user is in list
  });

  return NextResponse.json({ columns: visibleColumns });
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
  const visibleTo: number[] = body.visibleTo || [];

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

  const column = created[0];

  // Set visibility if specific users selected
  if (visibleTo.length > 0) {
    for (const userId of visibleTo) {
      db.insert(columnVisibility)
        .values({ columnId: column.id, userId })
        .run();
    }
  }

  return NextResponse.json({ column }, { status: 201 });
}

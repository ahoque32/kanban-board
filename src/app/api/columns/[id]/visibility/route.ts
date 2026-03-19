import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ensureDbInitialized } from "@/lib/init";
import { columnVisibility } from "@/lib/schema";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  await ensureDbInitialized();

  const auth = requireAdmin(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const columnId = Number(id);
  if (!columnId) {
    return NextResponse.json({ error: "Invalid column ID" }, { status: 400 });
  }

  const body = await request.json();
  const visibleTo: number[] = body.visibleTo || [];

  // Clear existing visibility for this column
  db.delete(columnVisibility).where(eq(columnVisibility.columnId, columnId)).run();

  // Set new visibility (empty = visible to all)
  for (const userId of visibleTo) {
    db.insert(columnVisibility).values({ columnId, userId }).run();
  }

  return NextResponse.json({ ok: true });
}

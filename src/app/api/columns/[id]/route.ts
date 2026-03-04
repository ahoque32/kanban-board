import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/init";
import { columns } from "@/lib/schema";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  await ensureDbInitialized();

  const { id } = await params;
  const columnId = Number(id);
  if (Number.isNaN(columnId)) {
    return NextResponse.json({ error: "Invalid column id" }, { status: 400 });
  }

  const body = await request.json();
  const updates: { name?: string; position?: number } = {};

  if (typeof body.name === "string") {
    updates.name = body.name.trim();
  }

  if (typeof body.position === "number") {
    updates.position = body.position;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const updated = await db.update(columns).set(updates).where(eq(columns.id, columnId)).returning();
  if (!updated[0]) {
    return NextResponse.json({ error: "Column not found" }, { status: 404 });
  }

  return NextResponse.json({ column: updated[0] });
}

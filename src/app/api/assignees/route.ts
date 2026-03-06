import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assignees } from "@/lib/schema";
import { ensureDbInitialized } from "@/lib/init";

export async function GET() {
  await ensureDbInitialized();
  const all = db.select().from(assignees).all();
  return NextResponse.json({ assignees: all });
}

export async function POST(req: Request) {
  await ensureDbInitialized();
  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const result = db.insert(assignees).values({ name: name.trim() }).returning().get();
    return NextResponse.json({ assignee: result });
  } catch {
    return NextResponse.json({ error: "Assignee already exists" }, { status: 409 });
  }
}

export async function DELETE(req: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  db.delete(assignees).where(eq(assignees.id, id)).run();
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth";
import { assignees, settings, users } from "@/lib/schema";
import { ensureDbInitialized } from "@/lib/init";

export async function GET(request: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAuth(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admins always see all assignees
  if (auth.user.role === "admin") {
    const all = db.select().from(assignees).all();
    return NextResponse.json({ assignees: all });
  }

  // Check the assign mode setting
  const [config] = db.select().from(settings).where(eq(settings.id, 1)).limit(1).all();
  const mode = config?.assignMode || "restricted";

  if (mode === "unrestricted") {
    const all = db.select().from(assignees).all();
    return NextResponse.json({ assignees: all });
  }

  // Restricted: non-admins can only assign to themselves or admin users
  const admins = db.select().from(users).where(eq(users.role, "admin")).all();
  const adminNames = admins.map((a) => a.name);
  const allowed = [auth.user.name, ...adminNames.filter((n) => n !== auth.user.name)];
  return NextResponse.json({
    assignees: allowed.map((name, i) => ({ id: -(i + 1), name })),
  });
}

export async function POST(req: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAdmin(req);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

export async function DELETE(req: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAdmin(req);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  db.delete(assignees).where(eq(assignees.id, id)).run();
  return NextResponse.json({ ok: true });
}

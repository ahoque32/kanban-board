import { count, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ensureDbInitialized } from "@/lib/init";
import { users } from "@/lib/schema";

export async function GET(request: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAdmin(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const list = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      assignMode: users.assignMode,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt);

  return NextResponse.json({ users: list });
}

export async function PATCH(request: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAdmin(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const userId = Number(body.userId);

  // Handle assign mode update
  if (body.assignMode === "restricted" || body.assignMode === "unrestricted") {
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    await db.update(users).set({ assignMode: body.assignMode }).where(eq(users.id, userId));
    return NextResponse.json({ ok: true });
  }

  const role = body.role === "admin" ? "admin" : body.role === "user" ? "user" : null;

  if (!userId || !role) {
    return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
  }

  if (userId === auth.user.id && role !== "admin") {
    return NextResponse.json({ error: "Cannot remove your own admin role" }, { status: 400 });
  }

  if (role === "user") {
    const [adminCount] = await db.select({ value: count() }).from(users).where(eq(users.role, "admin"));
    const target = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);

    if (target[0]?.role === "admin" && (adminCount?.value ?? 0) <= 1) {
      return NextResponse.json({ error: "At least one admin is required" }, { status: 400 });
    }
  }

  const updated = await db.update(users).set({ role }).where(eq(users.id, userId)).returning();
  if (!updated[0]) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

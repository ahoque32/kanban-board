import { and, count, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUserFromCookies } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/init";
import { users } from "@/lib/schema";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  await ensureDbInitialized();
  const currentUser = await getCurrentUserFromCookies();

  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const userId = Number(id);
  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const body = await request.json();
  const role = body.role;

  if (role !== "admin" && role !== "user") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (userId === currentUser.id && role !== "admin") {
    return NextResponse.json({ error: "You cannot remove your own admin role" }, { status: 400 });
  }

  if (role !== "admin") {
    const [adminsLeft] = await db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.role, "admin"), ne(users.id, userId)));

    if ((adminsLeft?.value ?? 0) === 0) {
      return NextResponse.json({ error: "At least one admin user is required" }, { status: 400 });
    }
  }

  const updated = await db.update(users).set({ role }).where(eq(users.id, userId)).returning();

  if (!updated[0]) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: updated[0].id,
      email: updated[0].email,
      name: updated[0].name,
      role: updated[0].role,
      createdAt: updated[0].createdAt,
    },
  });
}

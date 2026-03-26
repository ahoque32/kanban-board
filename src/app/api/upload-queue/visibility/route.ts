import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ensureDbInitialized } from "@/lib/init";
import { uploadQueueVisibility } from "@/lib/schema";

export async function GET(request: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAdmin(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db
    .select({ userId: uploadQueueVisibility.userId })
    .from(uploadQueueVisibility);

  return NextResponse.json({ userIds: rows.map((row) => row.userId) });
}

export async function PUT(request: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAdmin(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const requestedUserIds: unknown[] = Array.isArray(body.userIds) ? body.userIds : [];
  const userIds = [
    ...new Set(
      requestedUserIds
        .map((value: unknown) => Number(value))
        .filter((value): value is number => Number.isInteger(value) && value > 0),
    ),
  ];

  await db.delete(uploadQueueVisibility);

  if (userIds.length > 0) {
    await db.insert(uploadQueueVisibility).values(userIds.map((userId) => ({ userId })));
  }

  return NextResponse.json({ userIds });
}

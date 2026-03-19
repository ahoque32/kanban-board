import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, signAuthToken, setAuthCookie } from "@/lib/auth";
import { ensureDbInitialized } from "@/lib/init";
import { users } from "@/lib/schema";

export async function POST(request: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAdmin(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const userId = Number(body.userId);

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const [target] = db.select().from(users).where(eq(users.id, userId)).limit(1).all();
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Sign a token as the target user
  const token = signAuthToken({
    id: target.id,
    email: target.email,
    name: target.name,
    role: target.role,
  });

  const response = NextResponse.json({
    ok: true,
    user: { id: target.id, name: target.name, role: target.role },
  });

  setAuthCookie(response, token);
  return response;
}

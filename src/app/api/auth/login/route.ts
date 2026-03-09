import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/init";
import { users } from "@/lib/schema";
import { comparePassword, setAuthCookie, signAuthToken } from "@/lib/auth";

export async function POST(request: Request) {
  await ensureDbInitialized();

  const body = await request.json();
  const email = (body.email || "").toString().trim().toLowerCase();
  const password = (body.password || "").toString();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = existing[0];
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const matches = await comparePassword(password, user.passwordHash);
  if (!matches) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = signAuthToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });

  setAuthCookie(response, token);
  return response;
}

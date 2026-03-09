import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/init";
import { users } from "@/lib/schema";
import { hashPassword, setAuthCookie, signAuthToken } from "@/lib/auth";

export async function POST(request: Request) {
  await ensureDbInitialized();

  const body = await request.json();
  const email = (body.email || "").toString().trim().toLowerCase();
  const name = (body.name || "").toString().trim();
  const password = (body.password || "").toString();

  if (!email || !name || !password) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const created = await db
    .insert(users)
    .values({
      email,
      name,
      passwordHash,
      role: "user",
    })
    .returning();

  const user = created[0];
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

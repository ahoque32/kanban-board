import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { users } from "@/lib/schema";
import { ensureDbInitialized } from "@/lib/init";

export async function GET(request: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAuth(request);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admins always see all users as assignees
  if (auth.user.role === "admin") {
    const all = db.select({ id: users.id, name: users.name }).from(users).all();
    return NextResponse.json({ assignees: all });
  }

  // Check this user's assign mode
  const [dbUser] = db.select().from(users).where(eq(users.id, auth.user.id)).limit(1).all();
  const mode = dbUser?.assignMode || "restricted";

  if (mode === "unrestricted") {
    const all = db.select({ id: users.id, name: users.name }).from(users).all();
    return NextResponse.json({ assignees: all });
  }

  // Restricted: only self + admin users
  const admins = db.select({ id: users.id, name: users.name }).from(users).where(eq(users.role, "admin")).all();
  const self = { id: auth.user.id, name: auth.user.name };
  const adminIds = new Set(admins.map((a) => a.id));
  const allowed = adminIds.has(self.id) ? admins : [self, ...admins];
  return NextResponse.json({ assignees: allowed });
}

// POST and DELETE removed — assignees are now managed via Users (accounts)

import { NextRequest, NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { attachments, cards } from "@/lib/schema";
import { ensureDbInitialized } from "@/lib/init";

const UPLOAD_DIR = process.env.NODE_ENV === "production" ? "/app/data/uploads" : "./uploads";

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function userCardScope(user: { id: number; role: "admin" | "user"; name: string }, cardId: number) {
  if (user.role === "admin") {
    return eq(cards.id, cardId);
  }

  return and(
    eq(cards.id, cardId),
    or(eq(cards.assignee, user.name), eq(cards.createdBy, user.id))
  );
}

async function hasCardAccess(user: { id: number; role: "admin" | "user"; name: string }, cardId: number) {
  const allowed = await db.select({ id: cards.id }).from(cards).where(userCardScope(user, cardId)).limit(1);
  return Boolean(allowed[0]);
}

export async function GET(req: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAuth(req);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cardId = Number(req.nextUrl.searchParams.get("cardId"));
  if (!cardId) {
    return NextResponse.json({ error: "cardId required" }, { status: 400 });
  }

  if (!(await hasCardAccess(auth.user, cardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const files = db.select().from(attachments).where(eq(attachments.cardId, cardId)).all();

  return NextResponse.json({ attachments: files });
}

export async function POST(req: NextRequest) {
  await ensureDbInitialized();
  ensureUploadDir();

  const auth = requireAuth(req);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const cardId = Number(formData.get("cardId"));
  const file = formData.get("file") as File | null;

  if (!cardId || !file) {
    return NextResponse.json({ error: "cardId and file required" }, { status: 400 });
  }

  if (!(await hasCardAccess(auth.user, cardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ext = path.extname(file.name);
  const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
  const uniqueName = `${cardId}_${Date.now()}_${baseName}${ext}`;
  const storagePath = path.join(UPLOAD_DIR, uniqueName);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(storagePath, buffer);

  const result = db
    .insert(attachments)
    .values({
      cardId,
      filename: file.name,
      storagePath: uniqueName,
      mimeType: file.type || "application/octet-stream",
      size: buffer.length,
    })
    .returning()
    .get();

  return NextResponse.json({ attachment: result });
}

export async function DELETE(req: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAuth(req);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const existing = db.select().from(attachments).where(eq(attachments.id, id)).get();
  if (!existing) {
    return NextResponse.json({ ok: true });
  }

  if (!(await hasCardAccess(auth.user, existing.cardId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filePath = path.join(UPLOAD_DIR, existing.storagePath);
  try {
    fs.unlinkSync(filePath);
  } catch {
    // File may already be gone
  }

  db.delete(attachments).where(eq(attachments.id, id)).run();
  return NextResponse.json({ ok: true });
}

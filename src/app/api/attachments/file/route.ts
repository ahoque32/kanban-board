import { NextRequest, NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { attachments, cards } from "@/lib/schema";
import { ensureDbInitialized } from "@/lib/init";

const UPLOAD_DIR = process.env.NODE_ENV === "production" ? "/app/data/uploads" : "./uploads";

function userCardScope(user: { id: number; role: "admin" | "user"; name: string }, cardId: number) {
  if (user.role === "admin") {
    return eq(cards.id, cardId);
  }

  return and(
    eq(cards.id, cardId),
    or(eq(cards.assignee, user.name), eq(cards.createdBy, user.id))
  );
}

export async function GET(req: NextRequest) {
  await ensureDbInitialized();

  const auth = requireAuth(req);
  if (auth.response || !auth.user) {
    return auth.response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = req.nextUrl.searchParams.get("name");
  if (!name) {
    return new NextResponse("Missing name", { status: 400 });
  }

  const safeName = path.basename(name);

  const attachment = db.select().from(attachments).where(eq(attachments.storagePath, safeName)).get();
  if (!attachment) {
    return new NextResponse("Not found", { status: 404 });
  }

  const allowed = await db
    .select({ id: cards.id })
    .from(cards)
    .where(userCardScope(auth.user, attachment.cardId))
    .limit(1);

  if (!allowed[0]) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const filePath = path.join(UPLOAD_DIR, safeName);

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(safeName).toLowerCase();

  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".zip": "application/zip",
    ".mp4": "video/mp4",
    ".mp3": "audio/mpeg",
  };

  const contentType = mimeTypes[ext] || "application/octet-stream";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

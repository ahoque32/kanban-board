import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const UPLOAD_DIR =
  process.env.NODE_ENV === "production" ? "/app/data/uploads" : "./uploads";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) {
    return new NextResponse("Missing name", { status: 400 });
  }

  // Prevent directory traversal
  const safeName = path.basename(name);
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

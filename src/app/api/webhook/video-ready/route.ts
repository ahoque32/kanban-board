import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDiscordVideoReadyNotification } from "@/lib/discord";
import { ensureDbInitialized } from "@/lib/init";
import { uploadQueue } from "@/lib/schema";

function parseParams(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return {
    title: params.get("title")?.trim() || "",
    date: params.get("date")?.trim() || "",
    notes: params.get("notes")?.trim() || "",
    driveLink: params.get("driveLink")?.trim() || "",
  };
}

async function handleRequest(request: NextRequest) {
  await ensureDbInitialized();

  const { title, date, notes, driveLink } = parseParams(request);

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  try {
    await sendDiscordVideoReadyNotification({
      title,
      date,
      notes,
      driveLink: driveLink || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send Discord webhook";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const [item] = await db
    .insert(uploadQueue)
    .values({
      title,
      date,
      status: "ready",
      driveLink: driveLink || null,
      notes,
      webhookFired: 1,
      updatedAt: new Date().toISOString(),
    })
    .returning();

  return NextResponse.json({ ok: true, item });
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

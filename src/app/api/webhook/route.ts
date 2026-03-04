import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/init";
import { settings } from "@/lib/schema";

export async function GET() {
  await ensureDbInitialized();
  const row = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return NextResponse.json({
    discordWebhookUrl: row[0]?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL || "",
  });
}

export async function POST(request: Request) {
  await ensureDbInitialized();
  const body = await request.json();
  const discordWebhookUrl = body.discordWebhookUrl?.toString().trim() || "";

  await db
    .update(settings)
    .set({
      discordWebhookUrl: discordWebhookUrl || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(settings.id, 1));

  return NextResponse.json({ ok: true });
}

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/init";
import { ASSIGNEES, settings, webhooks } from "@/lib/schema";

// GET — return all webhooks + global setting
export async function GET() {
  await ensureDbInitialized();

  const [global] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  const allWebhooks = await db.select().from(webhooks);

  return NextResponse.json({
    globalWebhookUrl: global?.discordWebhookUrl || "",
    assignees: ASSIGNEES,
    webhooks: allWebhooks.map((w) => ({
      id: w.id,
      assignee: w.assignee,
      webhookUrl: w.webhookUrl,
      label: w.label,
      enabled: Boolean(w.enabled),
    })),
  });
}

// POST — add or update webhooks
export async function POST(request: Request) {
  await ensureDbInitialized();
  const body = await request.json();

  // Update global webhook
  if (typeof body.globalWebhookUrl === "string") {
    await db
      .update(settings)
      .set({
        discordWebhookUrl: body.globalWebhookUrl.trim() || null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(settings.id, 1));
  }

  // Add a new per-assignee webhook
  if (body.addWebhook) {
    const { assignee, webhookUrl, label } = body.addWebhook;
    if (!assignee || !webhookUrl) {
      return NextResponse.json({ error: "assignee and webhookUrl required" }, { status: 400 });
    }
    const created = await db
      .insert(webhooks)
      .values({
        assignee: assignee.toString().trim(),
        webhookUrl: webhookUrl.toString().trim(),
        label: (label || "").toString().trim(),
        enabled: 1,
      })
      .returning();
    return NextResponse.json({ ok: true, webhook: created[0] }, { status: 201 });
  }

  // Toggle enabled
  if (body.toggleWebhook) {
    const { id, enabled } = body.toggleWebhook;
    await db
      .update(webhooks)
      .set({ enabled: enabled ? 1 : 0 })
      .where(eq(webhooks.id, Number(id)));
    return NextResponse.json({ ok: true });
  }

  // Delete a webhook
  if (body.deleteWebhook) {
    await db.delete(webhooks).where(eq(webhooks.id, Number(body.deleteWebhook.id)));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

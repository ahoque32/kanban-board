import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/init";
import { settings, webhooks, users } from "@/lib/schema";
import { requireSession } from "@/lib/session";

function normalizeWebhookScope(value: unknown): "all" | "tasks" | "upload_queue" {
  return value === "tasks" || value === "upload_queue" ? value : "all";
}

// GET — return all webhooks + global setting
export async function GET(request: NextRequest) {
  await ensureDbInitialized();
  const { response, user } = requireSession(request);
  if (response || !user) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Only admins can view webhook settings" }, { status: 403 });
  }

  const [global] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  const allWebhooks = await db.select().from(webhooks);

  return NextResponse.json({
    globalWebhookUrl: global?.discordWebhookUrl || "",
    assignMode: global?.assignMode || "restricted",
    assignees: db.select({ name: users.name }).from(users).all().map((a) => a.name),
    webhooks: allWebhooks.map((w) => ({
      id: w.id,
      assignee: w.assignee,
      webhookUrl: w.webhookUrl,
      label: w.label,
      scope: normalizeWebhookScope(w.scope),
      enabled: Boolean(w.enabled),
    })),
  });
}

// POST — add or update webhooks
export async function POST(request: NextRequest) {
  await ensureDbInitialized();
  const { response, user } = requireSession(request);
  if (response || !user) return response ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Only admins can update webhook settings" }, { status: 403 });
  }

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

  // Update assign mode
  if (body.assignMode === "restricted" || body.assignMode === "unrestricted") {
    await db
      .update(settings)
      .set({ assignMode: body.assignMode, updatedAt: new Date().toISOString() })
      .where(eq(settings.id, 1));
  }

  // Add a new per-assignee webhook
  if (body.addWebhook) {
    const { assignee, webhookUrl, label, scope } = body.addWebhook;
    if (!assignee || !webhookUrl) {
      return NextResponse.json({ error: "assignee and webhookUrl required" }, { status: 400 });
    }
    const created = await db
      .insert(webhooks)
      .values({
        assignee: assignee.toString().trim(),
        webhookUrl: webhookUrl.toString().trim(),
        label: (label || "").toString().trim(),
        scope: normalizeWebhookScope(scope),
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

  if (body.updateWebhookScope) {
    const { id, scope } = body.updateWebhookScope;
    await db
      .update(webhooks)
      .set({ scope: normalizeWebhookScope(scope) })
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

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { settings, webhooks } from "@/lib/schema";

export type DiscordEvent = "created" | "moved" | "completed";

type NotifyPayload = {
  title: string;
  assignee: string;
  toColumn: string;
  fromColumn?: string;
  timestamp?: string;
};

async function getWebhookUrlsForAssignee(assignee: string): Promise<string[]> {
  // Get per-assignee webhooks
  const assigneeHooks = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.assignee, assignee));

  const urls = assigneeHooks
    .filter((h) => h.enabled)
    .map((h) => h.webhookUrl)
    .filter(Boolean);

  // Also get the global "all" webhook (settings table) as fallback
  const [global] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  const globalUrl = global?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL || "";

  // Get webhooks for "*" (all assignees)
  const allHooks = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.assignee, "*"));

  const allUrls = allHooks
    .filter((h) => h.enabled)
    .map((h) => h.webhookUrl)
    .filter(Boolean);

  if (globalUrl) allUrls.push(globalUrl);

  // Deduplicate
  return [...new Set([...urls, ...allUrls])];
}

async function sendToWebhook(url: string, body: object) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error(`Discord webhook error (${url}):`, error);
  }
}

export async function sendDiscordTaskNotification(event: DiscordEvent, payload: NotifyPayload) {
  const urls = await getWebhookUrlsForAssignee(payload.assignee);
  if (urls.length === 0) return;

  const colors: Record<DiscordEvent, number> = {
    created: 0x60a5fa,
    moved: 0xa78bfa,
    completed: 0x34d399,
  };

  const titles: Record<DiscordEvent, string> = {
    created: "📋 New Task Created",
    moved: "🔄 Task Moved",
    completed: "✅ Task Completed",
  };

  const description =
    event === "moved" && payload.fromColumn
      ? `Moved from **${payload.fromColumn}** → **${payload.toColumn}**`
      : `Column: **${payload.toColumn}**`;

  const embed = {
    title: titles[event],
    color: colors[event],
    fields: [
      { name: "Task", value: payload.title, inline: false },
      { name: "Assignee", value: payload.assignee || "Unassigned", inline: true },
      { name: "Column", value: payload.toColumn, inline: true },
    ],
    description,
    timestamp: payload.timestamp || new Date().toISOString(),
  };

  const body = { embeds: [embed] };
  await Promise.allSettled(urls.map((url) => sendToWebhook(url, body)));
}

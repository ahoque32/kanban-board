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

type WebhookScope = "all" | "tasks" | "upload_queue";

function normalizeLegacyScope(scope: string | null | undefined, label: string | null | undefined): WebhookScope {
  if (scope === "tasks" || scope === "upload_queue") return scope;

  const normalizedLabel = (label || "").toLowerCase();
  if (
    normalizedLabel.includes("upload") ||
    normalizedLabel.includes("queue") ||
    normalizedLabel.includes("video") ||
    normalizedLabel.includes("ready")
  ) {
    return "upload_queue";
  }

  return "all";
}

function matchesScope(scope: string | null | undefined, label: string | null | undefined, eventType: "tasks" | "upload_queue") {
  const normalizedScope = normalizeLegacyScope(scope, label);
  return normalizedScope === "all" || normalizedScope === eventType;
}

async function getWebhookUrlsForAssignee(assignee: string): Promise<string[]> {
  // Get per-assignee webhooks
  const assigneeHooks = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.assignee, assignee));

  const urls = assigneeHooks
    .filter((h) => h.enabled && matchesScope(h.scope, h.label, "tasks"))
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
    .filter((h) => h.enabled && matchesScope(h.scope, h.label, "tasks"))
    .map((h) => h.webhookUrl)
    .filter(Boolean);

  if (globalUrl) allUrls.push(globalUrl);

  // Deduplicate
  return [...new Set([...urls, ...allUrls])];
}

async function sendToWebhook(url: string, body: object) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Webhook responded with ${response.status}`);
    }
  } catch (error) {
    console.error(`Discord webhook error (${url}):`, error);
    throw error;
  }
}

async function getGlobalDiscordWebhookUrls(): Promise<string[]> {
  // Prefer env var (always set on Cloud Run), fall back to DB settings
  const [global] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  const globalUrl = process.env.DISCORD_WEBHOOK_URL || global?.discordWebhookUrl || "";

  // Also include any wildcard/all-assignee webhooks so upload-ready notifications
  // can fan out to multiple Discord channels, not just the single global URL.
  const allHooks = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.assignee, "*"));

  const allUrls = allHooks
    .filter((h) => h.enabled && matchesScope(h.scope, h.label, "upload_queue"))
    .map((h) => h.webhookUrl)
    .filter(Boolean);

  return [...new Set([globalUrl, ...allUrls].filter(Boolean))];
}

export async function getGlobalDiscordWebhookUrl(): Promise<string> {
  const [first] = await getGlobalDiscordWebhookUrls();
  return first || "";
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

type VideoReadyPayload = {
  title: string;
  date: string;
  notes: string;
  driveLink?: string | null;
};

export async function sendDiscordVideoReadyNotification(payload: VideoReadyPayload) {
  const urls = await getGlobalDiscordWebhookUrls();
  if (urls.length === 0) {
    throw new Error("Discord webhook URL is not configured");
  }

  const lines = [
    "🎬 **Video Ready for Upload!**",
    `📅 Date: ${payload.date}`,
    `🎥 Title: ${payload.title}`,
    `📝 Notes: ${payload.notes || "None"}`,
  ];

  if (payload.driveLink) {
    lines.push(`🔗 Drive: ${payload.driveLink}`);
  }

  lines.push("", "Director — this video is ready. Check Drive and upload to all platforms.");

  await Promise.allSettled(urls.map((url) => sendToWebhook(url, { content: lines.join("\n") })));
}

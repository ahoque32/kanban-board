import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { settings } from "@/lib/schema";

export type DiscordEvent = "created" | "moved" | "completed";

type NotifyPayload = {
  title: string;
  assignee: string;
  toColumn: string;
  fromColumn?: string;
  timestamp?: string;
};

export async function getDiscordWebhookUrl() {
  const row = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
  return row[0]?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL || "";
}

export async function sendDiscordTaskNotification(event: DiscordEvent, payload: NotifyPayload) {
  const webhookUrl = await getDiscordWebhookUrl();
  if (!webhookUrl) return;

  const colors: Record<DiscordEvent, number> = {
    created: 0x60a5fa,
    moved: 0xa78bfa,
    completed: 0x34d399,
  };

  const titles: Record<DiscordEvent, string> = {
    created: "New Task Created",
    moved: "Task Moved",
    completed: "Task Completed",
  };

  const description =
    event === "moved" && payload.fromColumn
      ? `Moved from **${payload.fromColumn}** to **${payload.toColumn}**`
      : `Current column: **${payload.toColumn}**`;

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

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (error) {
    console.error("Discord webhook error:", error);
  }
}

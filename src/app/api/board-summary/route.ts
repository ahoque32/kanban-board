import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/init";
import { boards, cards, columns, users, attachments } from "@/lib/schema";

/**
 * Public read-only board summary for cron/bot consumption.
 * No auth required — returns full card details including
 * descriptions, labels, attachments, and due dates.
 */
export async function GET() {
  await ensureDbInitialized();

  const board = await db.select().from(boards).limit(1);
  if (!board[0]) {
    return NextResponse.json({ error: "No board" }, { status: 404 });
  }

  const allColumns = await db
    .select()
    .from(columns)
    .where(eq(columns.boardId, board[0].id))
    .orderBy(asc(columns.position));

  const allCards = await db
    .select()
    .from(cards)
    .where(eq(cards.boardId, board[0].id))
    .orderBy(asc(cards.position));

  // Resolve user names
  const allUsers = db.select({ id: users.id, name: users.name }).from(users).all();
  const userMap: Record<number, string> = {};
  for (const u of allUsers) userMap[u.id] = u.name;

  // Get all attachments
  const allAttachments = db.select().from(attachments).all();
  const attachmentsByCard: Record<number, typeof allAttachments> = {};
  for (const a of allAttachments) {
    if (!attachmentsByCard[a.cardId]) attachmentsByCard[a.cardId] = [];
    attachmentsByCard[a.cardId].push(a);
  }

  const priorityEmoji: Record<string, string> = { high: "🔴", med: "🟡", low: "🟢" };
  const APP_URL = process.env.APP_URL || process.env.KANBAN_URL || "https://kanban-board-457623930004.us-east1.run.app";

  function parseLabels(raw: string): string[] {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  const columnData = allColumns.map((col) => {
    const colCards = allCards.filter((c) => c.columnId === col.id);
    return {
      name: col.name,
      count: colCards.length,
      cards: colCards.map((c) => {
        const cardAttachments = attachmentsByCard[c.id] || [];
        const labels = parseLabels(c.labels);
        return {
          id: c.id,
          title: c.title,
          description: c.description || null,
          assignee: c.assignee || "Unassigned",
          priority: c.priority,
          priorityEmoji: priorityEmoji[c.priority] || "⚪",
          labels,
          createdBy: c.createdBy ? (userMap[c.createdBy] || "Unknown") : "Unknown",
          dueDate: c.dueDate,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          attachments: cardAttachments.map((a) => ({
            id: a.id,
            filename: a.filename,
            mimeType: a.mimeType,
            size: a.size,
            downloadUrl: `${APP_URL}/api/attachments/file?id=${a.id}`,
          })),
        };
      }),
    };
  });

  // Build plain text summary
  const lines: string[] = [
    `📊 **${board[0].name}** — ${allCards.length} total tasks`,
    "",
  ];

  for (const col of columnData) {
    lines.push(`**${col.name}** (${col.count})`);
    if (col.cards.length === 0) {
      lines.push("  _No tasks_");
    } else {
      for (const card of col.cards) {
        lines.push(
          `  ${card.priorityEmoji} **#${card.id} ${card.title}**`
        );
        lines.push(
          `    👤 ${card.assignee} | 📝 ${card.createdBy}${card.dueDate ? ` | 📅 ${card.dueDate}` : ""}`
        );
        if (card.description) {
          // Truncate long descriptions for Discord
          const desc = card.description.length > 200
            ? card.description.slice(0, 200) + "…"
            : card.description;
          lines.push(`    📄 ${desc}`);
        }
        if (card.labels.length > 0) {
          lines.push(`    🏷️ ${card.labels.join(", ")}`);
        }
        if (card.attachments.length > 0) {
          lines.push(`    📎 ${card.attachments.length} file${card.attachments.length > 1 ? "s" : ""}: ${card.attachments.map((a) => a.filename).join(", ")}`);
        }
      }
    }
    lines.push("");
  }

  return NextResponse.json({
    summary: lines.join("\n"),
    board: board[0].name,
    totalCards: allCards.length,
    columns: columnData,
  });
}

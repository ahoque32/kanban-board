import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureDbInitialized } from "@/lib/init";
import { boards, cards, columns, users } from "@/lib/schema";

/**
 * Public read-only board summary for cron/bot consumption.
 * No auth required — returns only aggregate data.
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

  const priorityEmoji: Record<string, string> = { high: "🔴", med: "🟡", low: "🟢" };

  const columnData = allColumns.map((col) => {
    const colCards = allCards.filter((c) => c.columnId === col.id);
    return {
      name: col.name,
      count: colCards.length,
      cards: colCards.map((c) => ({
        id: c.id,
        title: c.title,
        assignee: c.assignee || "Unassigned",
        priority: c.priority,
        priorityEmoji: priorityEmoji[c.priority] || "⚪",
        createdBy: c.createdBy ? (userMap[c.createdBy] || "Unknown") : "Unknown",
        dueDate: c.dueDate,
      })),
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
          `  ${card.priorityEmoji} #${card.id} ${card.title} — 👤${card.assignee} 📝${card.createdBy}`
        );
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

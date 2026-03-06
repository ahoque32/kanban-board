import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cards, columns, boards } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || "";

async function verifyDiscordRequest(req: NextRequest): Promise<{ isValid: boolean; body: string }> {
  const signature = req.headers.get("x-signature-ed25519") || "";
  const timestamp = req.headers.get("x-signature-timestamp") || "";
  const body = await req.text();

  if (!signature || !timestamp || !PUBLIC_KEY) {
    return { isValid: false, body };
  }

  try {
    const encoder = new TextEncoder();
    const message = encoder.encode(timestamp + body);
    const sigBytes = hexToUint8Array(signature);
    const keyBytes = hexToUint8Array(PUBLIC_KEY);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "Ed25519", namedCurve: "Ed25519" },
      false,
      ["verify"]
    );

    const isValid = await crypto.subtle.verify("Ed25519", cryptoKey, sigBytes, message);
    return { isValid, body };
  } catch {
    return { isValid: false, body };
  }
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Interaction types
const PING = 1;
const APPLICATION_COMMAND = 2;

// Response types
const PONG = 1;
const CHANNEL_MESSAGE = 4;

function reply(content: string, ephemeral = false) {
  return NextResponse.json({
    type: CHANNEL_MESSAGE,
    data: { content, flags: ephemeral ? 64 : 0 },
  });
}

export async function POST(req: NextRequest) {
  const { isValid, body } = await verifyDiscordRequest(req);
  if (!isValid) {
    return new NextResponse("Invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(body);

  // Handle ping (Discord verification)
  if (interaction.type === PING) {
    return NextResponse.json({ type: PONG });
  }

  if (interaction.type !== APPLICATION_COMMAND) {
    return reply("Unknown interaction type", true);
  }

  const { name, options } = interaction.data;
  const db = getDb();

  try {
    switch (name) {
      case "task": {
        const sub = options?.[0]?.name;
        const subOpts = options?.[0]?.options || [];
        const getOpt = (n: string) => subOpts.find((o: { name: string; value: string | number }) => o.name === n)?.value;

        if (sub === "add") {
          const title = getOpt("title") as string;
          const assignee = (getOpt("assignee") as string) || "";
          const priority = (getOpt("priority") as string) || "med";
          const description = (getOpt("description") as string) || "";

          const board = db.select().from(boards).limit(1).get();
          if (!board) return reply("❌ No board exists yet. Create one in the web UI first.", true);

          const firstCol = db
            .select()
            .from(columns)
            .where(eq(columns.boardId, board.id))
            .orderBy(columns.position)
            .limit(1)
            .get();
          if (!firstCol) return reply("❌ No columns on the board.", true);

          const existing = db
            .select()
            .from(cards)
            .where(and(eq(cards.boardId, board.id), eq(cards.columnId, firstCol.id)))
            .all();
          const maxPos = existing.reduce((max, c) => Math.max(max, c.position), -1);

          const now = new Date().toISOString();
          const result = db
            .insert(cards)
            .values({
              boardId: board.id,
              columnId: firstCol.id,
              title,
              description,
              assignee,
              priority,
              labels: "[]",
              position: maxPos + 1,
              createdAt: now,
              updatedAt: now,
            })
            .returning()
            .get();

          return reply(
            `✅ **Task #${result.id} created**\n` +
              `**${title}**\n` +
              `📋 Column: ${firstCol.name}\n` +
              (assignee ? `👤 Assignee: ${assignee}\n` : "") +
              `🔴 Priority: ${priority}`
          );
        }

        if (sub === "list") {
          const assignee = getOpt("assignee") as string | undefined;
          const columnName = getOpt("column") as string | undefined;

          const board = db.select().from(boards).limit(1).get();
          if (!board) return reply("No board exists.", true);

          let allCards = db
            .select()
            .from(cards)
            .where(eq(cards.boardId, board.id))
            .all();

          if (assignee) {
            allCards = allCards.filter((c) => c.assignee.toLowerCase() === assignee.toLowerCase());
          }

          const allCols = db.select().from(columns).where(eq(columns.boardId, board.id)).all();
          const colMap = Object.fromEntries(allCols.map((c) => [c.id, c.name]));

          if (columnName) {
            const col = allCols.find((c) => c.name.toLowerCase() === columnName.toLowerCase());
            if (col) allCards = allCards.filter((c) => c.columnId === col.id);
          }

          if (allCards.length === 0) return reply("No tasks found.", true);

          const priorityEmoji: Record<string, string> = { high: "🔴", med: "🟡", low: "🟢" };
          const lines = allCards.slice(0, 15).map(
            (c) =>
              `${priorityEmoji[c.priority] || "⚪"} **#${c.id}** ${c.title} — ${colMap[c.columnId] || "?"} ${c.assignee ? `(${c.assignee})` : ""}`
          );

          return reply(
            `📋 **Tasks** (${allCards.length} total)${allCards.length > 15 ? " — showing first 15" : ""}\n${lines.join("\n")}`
          );
        }

        if (sub === "move") {
          const taskId = getOpt("id") as number;
          const columnName = getOpt("column") as string;

          const card = db.select().from(cards).where(eq(cards.id, taskId)).get();
          if (!card) return reply(`❌ Task #${taskId} not found.`, true);

          const allCols = db.select().from(columns).where(eq(columns.boardId, card.boardId)).all();
          const targetCol = allCols.find((c) => c.name.toLowerCase() === columnName.toLowerCase());
          if (!targetCol) {
            const names = allCols.map((c) => c.name).join(", ");
            return reply(`❌ Column "${columnName}" not found. Available: ${names}`, true);
          }

          const now = new Date().toISOString();
          db.update(cards)
            .set({ columnId: targetCol.id, updatedAt: now })
            .where(eq(cards.id, taskId))
            .run();

          return reply(`✅ **#${taskId}** "${card.title}" → **${targetCol.name}**`);
        }

        if (sub === "assign") {
          const taskId = getOpt("id") as number;
          const assignee = getOpt("assignee") as string;

          const card = db.select().from(cards).where(eq(cards.id, taskId)).get();
          if (!card) return reply(`❌ Task #${taskId} not found.`, true);

          const now = new Date().toISOString();
          db.update(cards)
            .set({ assignee, updatedAt: now })
            .where(eq(cards.id, taskId))
            .run();

          return reply(`✅ **#${taskId}** "${card.title}" assigned to **${assignee}**`);
        }

        if (sub === "done") {
          const taskId = getOpt("id") as number;

          const card = db.select().from(cards).where(eq(cards.id, taskId)).get();
          if (!card) return reply(`❌ Task #${taskId} not found.`, true);

          const allCols = db
            .select()
            .from(columns)
            .where(eq(columns.boardId, card.boardId))
            .orderBy(columns.position)
            .all();
          const lastCol = allCols[allCols.length - 1];
          if (!lastCol) return reply("❌ No columns found.", true);

          const now = new Date().toISOString();
          db.update(cards)
            .set({ columnId: lastCol.id, updatedAt: now })
            .where(eq(cards.id, taskId))
            .run();

          return reply(`✅ **#${taskId}** "${card.title}" → **${lastCol.name}** 🎉`);
        }

        return reply("Unknown subcommand. Use: add, list, move, assign, done", true);
      }

      case "board": {
        const sub = options?.[0]?.name;

        if (sub === "summary") {
          const board = db.select().from(boards).limit(1).get();
          if (!board) return reply("No board exists.", true);

          const allCols = db
            .select()
            .from(columns)
            .where(eq(columns.boardId, board.id))
            .orderBy(columns.position)
            .all();
          const allCards = db
            .select()
            .from(cards)
            .where(eq(cards.boardId, board.id))
            .all();

          const lines = allCols.map((col) => {
            const count = allCards.filter((c) => c.columnId === col.id).length;
            return `**${col.name}:** ${count} task${count !== 1 ? "s" : ""}`;
          });

          return reply(
            `📊 **${board.name}** — ${allCards.length} total tasks\n${lines.join("\n")}`
          );
        }

        if (sub === "link") {
          const url = process.env.KANBAN_URL || "https://kanban-board-457623930004.us-east1.run.app";
          return reply(`🔗 **KanbanFlow:** ${url}`);
        }

        return reply("Unknown subcommand. Use: summary, link", true);
      }

      default:
        return reply(`Unknown command: ${name}`, true);
    }
  } catch (err: unknown) {
    console.error("Discord command error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return reply(`❌ Error: ${message}`, true);
  }
}

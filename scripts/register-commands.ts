/**
 * Register Discord slash commands for KanbanFlow
 * Usage: npx tsx scripts/register-commands.ts
 */

const APP_ID = process.env.DISCORD_APP_ID || "1479540475269742894";
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1477891199938461799";

const ASSIGNEE_CHOICES = [
  { name: "Ahawk", value: "Ahawk" },
  { name: "Tawfiq", value: "Tawfiq" },
  { name: "Luke", value: "Luke" },
];

const PRIORITY_CHOICES = [
  { name: "🔴 High", value: "high" },
  { name: "🟡 Medium", value: "med" },
  { name: "🟢 Low", value: "low" },
];

const commands = [
  {
    name: "task",
    description: "Manage kanban tasks",
    options: [
      {
        name: "add",
        description: "Create a new task",
        type: 1, // SUB_COMMAND
        options: [
          { name: "title", description: "Task title", type: 3, required: true },
          { name: "assignee", description: "Assign to", type: 3, choices: ASSIGNEE_CHOICES },
          { name: "priority", description: "Priority level", type: 3, choices: PRIORITY_CHOICES },
          { name: "description", description: "Task description", type: 3 },
        ],
      },
      {
        name: "list",
        description: "List tasks",
        type: 1,
        options: [
          { name: "assignee", description: "Filter by assignee", type: 3, choices: ASSIGNEE_CHOICES },
          { name: "column", description: "Filter by column name", type: 3 },
        ],
      },
      {
        name: "move",
        description: "Move a task to a column",
        type: 1,
        options: [
          { name: "id", description: "Task ID", type: 4, required: true }, // INTEGER
          { name: "column", description: "Target column name", type: 3, required: true },
        ],
      },
      {
        name: "assign",
        description: "Assign a task",
        type: 1,
        options: [
          { name: "id", description: "Task ID", type: 4, required: true },
          { name: "assignee", description: "Assign to", type: 3, required: true, choices: ASSIGNEE_CHOICES },
        ],
      },
      {
        name: "done",
        description: "Mark a task as done (moves to last column)",
        type: 1,
        options: [
          { name: "id", description: "Task ID", type: 4, required: true },
        ],
      },
    ],
  },
  {
    name: "board",
    description: "Board overview commands",
    options: [
      {
        name: "summary",
        description: "Show board summary with task counts per column",
        type: 1,
      },
      {
        name: "link",
        description: "Get the KanbanFlow web URL",
        type: 1,
      },
    ],
  },
];

async function register() {
  if (!BOT_TOKEN) {
    console.error("Set DISCORD_BOT_TOKEN env var");
    process.exit(1);
  }

  // Register as guild commands (instant, no 1hr cache)
  const url = `https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to register commands: ${res.status} ${err}`);
    process.exit(1);
  }

  const result = await res.json();
  console.log(`✅ Registered ${result.length} commands for guild ${GUILD_ID}`);
  result.forEach((cmd: any) => console.log(`  /${cmd.name} — ${cmd.description}`));
}

register();

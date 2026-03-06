import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const boards = sqliteTable("boards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const columns = sqliteTable("columns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  boardId: integer("board_id").notNull(),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const priorities = ["low", "med", "high"] as const;
export type Priority = (typeof priorities)[number];

export const cards = sqliteTable("cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  boardId: integer("board_id").notNull(),
  columnId: integer("column_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  assignee: text("assignee").notNull().default(""),
  dueDate: text("due_date"),
  priority: text("priority", { enum: priorities }).notNull().default("med"),
  labels: text("labels").notNull().default("[]"),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  discordWebhookUrl: text("discord_webhook_url"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const webhooks = sqliteTable("webhooks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assignee: text("assignee").notNull(),
  webhookUrl: text("webhook_url").notNull(),
  label: text("label").notNull().default(""),
  enabled: integer("enabled").notNull().default(1),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

// Default assignees — actual list is stored in DB settings and editable from UI
export const DEFAULT_ASSIGNEES = ["Ahawk", "Luke"];
export type Assignee = string;

export const assignees = sqliteTable("assignees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

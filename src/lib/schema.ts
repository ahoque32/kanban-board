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
  createdBy: integer("created_by"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const assignModes = ["restricted", "unrestricted"] as const;
export type AssignMode = (typeof assignModes)[number];

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  discordWebhookUrl: text("discord_webhook_url"),
  assignMode: text("assign_mode").notNull().default("restricted"),
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

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
  assignMode: text("assign_mode").notNull().default("restricted"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

// Default assignees — actual list is stored in DB settings and editable from UI
export const DEFAULT_ASSIGNEES = ["Ahawk", "Luke"];
export type Assignee = string;

export const attachments = sqliteTable("attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardId: integer("card_id").notNull(),
  filename: text("filename").notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type").notNull().default("application/octet-stream"),
  size: integer("size").notNull().default(0),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const inviteTokens = sqliteTable("invite_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  used: integer("used").notNull().default(0),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const assignees = sqliteTable("assignees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

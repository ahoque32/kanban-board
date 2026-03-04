# KanbanFlow

Public-facing Kanban board built with Next.js 15, TypeScript, Tailwind CSS v4, shadcn-style UI components, Drizzle ORM + SQLite, and @dnd-kit drag-and-drop.

## Features
- Public board with no auth
- Default columns: `To Do`, `In Progress`, `Done`
- Add custom columns
- Cards with title, description, assignee, due date, priority, and labels
- Drag and drop cards between columns
- Filtering by assignee, priority, and label
- Discord webhook notifications for:
  - Task created
  - Task moved
  - Task completed (when moved to `Done`)
- Apple-inspired liquid glass UI

## Stack
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4
- shadcn-style reusable UI components
- @dnd-kit
- SQLite + Drizzle ORM

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables
- `DATABASE_URL` default: `./drizzle/kanban.db`
- `DISCORD_WEBHOOK_URL` optional global default webhook URL
- `PORT` used for local runtime

## Scripts
- `npm run dev` - local dev server
- `npm run build` - production build
- `npm run start` - production server
- `npm run lint` - lint
- `npm run db:generate` - generate Drizzle SQL from schema
- `npm run db:migrate` - initialize local SQLite schema


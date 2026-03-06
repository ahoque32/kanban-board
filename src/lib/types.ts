export type Priority = "low" | "med" | "high";

export type KanbanCard = {
  id: number;
  boardId: number;
  columnId: number;
  title: string;
  description: string;
  assignee: string;
  dueDate: string | null;
  priority: Priority;
  labels: string[];
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type KanbanColumn = {
  id: number;
  boardId: number;
  name: string;
  position: number;
  createdAt: string;
};

export type KanbanBoard = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type Attachment = {
  id: number;
  cardId: number;
  filename: string;
  storagePath: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

export type BoardResponse = {
  board: KanbanBoard;
  columns: KanbanColumn[];
  cards: KanbanCard[];
};

import type { AuthUser } from "@/lib/auth";

type CardAccessShape = {
  assignee: string;
  createdBy: number | null;
};

export function canAccessCard(user: AuthUser, card: CardAccessShape): boolean {
  if (user.role === "admin") return true;
  const assignedToUser = card.assignee.trim().toLowerCase() === user.name.trim().toLowerCase();
  return assignedToUser || card.createdBy === user.id;
}

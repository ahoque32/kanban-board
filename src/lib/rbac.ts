import type { AuthUser } from "@/lib/auth";

type CardAccessShape = {
  assignee: string;
  createdBy: number | null;
};

export function canAccessCard(user: AuthUser, card: CardAccessShape): boolean {
  if (user.role === "admin") return true;
  // Non-admins can access cards assigned to them or cards they created
  return (
    card.assignee.trim().toLowerCase() === user.name.trim().toLowerCase() ||
    card.createdBy === user.id
  );
}

import { and, eq, or } from "drizzle-orm";
import { type AuthUser } from "@/lib/auth";
import { cards } from "@/lib/schema";

export function cardVisibilityCondition(user: AuthUser) {
  if (user.role === "admin") return undefined; // admins see everything
  // Non-admins see cards assigned to them OR cards they created
  return or(
    eq(cards.assignee, user.name),
    eq(cards.createdBy, user.id)
  );
}

export function canAccessCard(user: AuthUser, card: { createdBy: number | null; assignee: string }) {
  if (user.role === "admin") return true;
  // Non-admins can access cards assigned to them or cards they created
  return card.assignee === user.name || card.createdBy === user.id;
}

export function cardAccessPredicate(user: AuthUser, cardId: number) {
  if (user.role === "admin") return eq(cards.id, cardId);
  return and(
    eq(cards.id, cardId),
    or(eq(cards.assignee, user.name), eq(cards.createdBy, user.id))
  );
}

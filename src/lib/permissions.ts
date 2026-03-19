import { and, eq, isNull, or } from "drizzle-orm";
import { type AuthUser } from "@/lib/auth";
import { cards } from "@/lib/schema";

export function cardVisibilityCondition(user: AuthUser) {
  if (user.role === "admin") return undefined; // admins see everything
  // Non-admins only see cards assigned to them
  return eq(cards.assignee, user.name);
}

export function canAccessCard(user: AuthUser, card: { createdBy: number | null; assignee: string }) {
  if (user.role === "admin") return true;
  // Non-admins can only access cards assigned to them
  return card.assignee === user.name;
}

export function cardAccessPredicate(user: AuthUser, cardId: number) {
  if (user.role === "admin") return eq(cards.id, cardId);
  return and(eq(cards.id, cardId), eq(cards.assignee, user.name));
}

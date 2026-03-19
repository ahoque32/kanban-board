import { and, eq, or } from "drizzle-orm";
import { type AuthUser } from "@/lib/auth";
import { cards } from "@/lib/schema";

export function cardVisibilityCondition(user: AuthUser) {
  if (user.role === "admin") return undefined;
  return or(eq(cards.createdBy, user.id), eq(cards.assignee, user.name));
}

export function canAccessCard(user: AuthUser, card: { createdBy: number | null; assignee: string }) {
  if (user.role === "admin") return true;
  return card.createdBy === user.id || card.assignee === user.name;
}

export function cardAccessPredicate(user: AuthUser, cardId: number) {
  if (user.role === "admin") return eq(cards.id, cardId);
  return and(eq(cards.id, cardId), or(eq(cards.createdBy, user.id), eq(cards.assignee, user.name)));
}

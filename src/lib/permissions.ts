import { and, eq, isNull, or } from "drizzle-orm";
import { type AuthUser } from "@/lib/auth";
import { cards } from "@/lib/schema";

export function cardVisibilityCondition(user: AuthUser) {
  if (user.role === "admin") return undefined;
  // Include cards with null createdBy (Discord/system-created) so all users can see them
  return or(eq(cards.createdBy, user.id), eq(cards.assignee, user.name), isNull(cards.createdBy));
}

export function canAccessCard(user: AuthUser, card: { createdBy: number | null; assignee: string }) {
  if (user.role === "admin") return true;
  // Allow access to cards with null createdBy (Discord/system-created)
  return card.createdBy === null || card.createdBy === user.id || card.assignee === user.name;
}

export function cardAccessPredicate(user: AuthUser, cardId: number) {
  if (user.role === "admin") return eq(cards.id, cardId);
  return and(
    eq(cards.id, cardId),
    or(eq(cards.createdBy, user.id), eq(cards.assignee, user.name), isNull(cards.createdBy)),
  );
}

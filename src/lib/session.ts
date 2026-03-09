import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromCookieHeader } from "@/lib/auth";

export function getSessionUser(request: NextRequest) {
  return getAuthUserFromCookieHeader(request.headers.get("cookie"));
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbiddenResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function requireSession(request: NextRequest) {
  const user = getSessionUser(request);
  if (!user) {
    return { response: unauthorizedResponse(), user: null } as const;
  }
  return { response: null, user } as const;
}

export function requireAdmin(request: NextRequest) {
  const { response, user } = requireSession(request);
  if (response || !user) return { response: response ?? unauthorizedResponse(), user: null } as const;
  if (user.role !== "admin") return { response: forbiddenResponse(), user: null } as const;
  return { response: null, user } as const;
}

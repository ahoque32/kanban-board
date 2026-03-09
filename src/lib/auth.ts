import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_COOKIE_NAME,
  createAuthToken,
  getAuthCookieConfig,
  getClearCookieConfig,
  type AuthUser,
  type UserRole,
  verifyAuthToken,
} from "@/lib/auth-token";

let bcryptModule: { hash: (input: string, rounds: number) => Promise<string>; compare: (input: string, hash: string) => Promise<boolean> } | null = null;

async function getBcrypt() {
  if (bcryptModule) return bcryptModule;
  try {
    const imported = (await import("bcryptjs")) as {
      hash: (input: string, rounds: number) => Promise<string>;
      compare: (input: string, hash: string) => Promise<boolean>;
    };
    bcryptModule = imported;
    return imported;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await getBcrypt();
  if (bcrypt) {
    return bcrypt.hash(password, 10);
  }

  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await getBcrypt();
  if (bcrypt && hash.startsWith("$2")) {
    return bcrypt.compare(password, hash);
  }

  if (!hash.startsWith("scrypt$")) {
    return false;
  }

  const parts = hash.split("$");
  const salt = parts[1];
  const digest = parts[2];
  if (!salt || !digest) return false;

  const computed = scryptSync(password, salt, 64);
  const stored = Buffer.from(digest, "hex");
  if (stored.length !== computed.length) return false;
  return timingSafeEqual(stored, computed);
}

export async function getCurrentUserFromCookies(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAuthToken(token);
}

export async function getCurrentUserFromRequest(req: NextRequest): Promise<AuthUser | null> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAuthToken(token);
}

export function isAdmin(user: AuthUser | null): user is AuthUser {
  return Boolean(user && user.role === "admin");
}

export { AUTH_COOKIE_NAME, type AuthUser, type UserRole } from "@/lib/auth-token";

export function requireAuth(request: NextRequest) {
  const headerPayload = request.headers.get("x-user-payload");
  if (!headerPayload) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), user: null };
  }
  try {
    const user = JSON.parse(headerPayload);
    return { response: null, user };
  } catch {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), user: null };
  }
}

export function requireAdmin(request: NextRequest) {
  const result = requireAuth(request);
  if (result.response || !result.user) return result;
  if (result.user.role !== "admin") {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }), user: null };
  }
  return result;
}

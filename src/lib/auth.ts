import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { NextResponse, type NextRequest } from "next/server";
export type UserRole = "admin" | "user";

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
};

type JwtPayload = {
  sub?: string | number;
  email?: string;
  name?: string;
  role?: UserRole;
};

export const AUTH_COOKIE_NAME = "kanban_auth";
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function getJwtSecret() {
  return process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";
}

function parseJwtPayload(payload: JwtPayload): AuthUser | null {
  const id = typeof payload.sub === "number" ? payload.sub : Number(payload.sub);
  if (!Number.isFinite(id)) return null;
  if (!payload.email || !payload.name) return null;
  if (payload.role !== "admin" && payload.role !== "user") return null;
  return {
    id,
    email: payload.email,
    name: payload.name,
    role: payload.role,
  };
}

function parseCookieHeaderValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return comparePassword(password, hash);
}

export function signAuthToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    getJwtSecret(),
    {
      algorithm: "HS256",
      expiresIn: TOKEN_TTL_SECONDS,
    },
  );
}

export async function createAuthToken(user: AuthUser): Promise<string> {
  return signAuthToken(user);
}

export function getAuthUserFromToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as JwtPayload;
    return parseJwtPayload(payload);
  } catch {
    return null;
  }
}

export async function verifyAuthToken(token: string): Promise<AuthUser | null> {
  return getAuthUserFromToken(token);
}

export function getAuthCookieConfig(token: string) {
  return {
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  };
}

export function getClearCookieConfig() {
  return {
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

export function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set(getAuthCookieConfig(token));
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(getClearCookieConfig());
}

export async function getCurrentUserFromCookies(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return getAuthUserFromToken(token);
}

export async function getAuthUserFromCookies(): Promise<AuthUser | null> {
  return getCurrentUserFromCookies();
}

export async function getCurrentUserFromRequest(req: NextRequest): Promise<AuthUser | null> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return getAuthUserFromToken(token);
}

export async function getAuthUserFromRequest(req: NextRequest): Promise<AuthUser | null> {
  return getCurrentUserFromRequest(req);
}

export function getAuthUserFromCookieHeader(cookieHeader: string | null | undefined): AuthUser | null {
  const token = parseCookieHeaderValue(cookieHeader, AUTH_COOKIE_NAME);
  if (!token) return null;
  return getAuthUserFromToken(token);
}

export function isAdmin(user: AuthUser | null): user is AuthUser {
  return Boolean(user && user.role === "admin");
}

/** Synthetic admin user for API key auth (bots/agents) */
const API_KEY_ADMIN: AuthUser = {
  id: 1,
  email: "admin@renderwise.net",
  name: "Admin",
  role: "admin",
};

function getApiKeyUser(request: NextRequest): AuthUser | null {
  const apiKey = process.env.BOARD_API_KEY;
  if (!apiKey) return null;
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${apiKey}`) return API_KEY_ADMIN;
  return null;
}

export function requireAuth(request: NextRequest) {
  // Check API key first (bot/agent access)
  const apiKeyUser = getApiKeyUser(request);
  if (apiKeyUser) return { response: null, user: apiKeyUser };

  const user = getAuthUserFromCookieHeader(request.headers.get("cookie"));
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), user: null };
  }
  return { response: null, user };
}

export function requireAdmin(request: NextRequest) {
  const result = requireAuth(request);
  if (result.response || !result.user) return result;
  if (result.user.role !== "admin") {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }), user: null };
  }
  return result;
}

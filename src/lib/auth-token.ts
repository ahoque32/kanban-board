import { signJwt, verifyJwt } from "@/lib/jwt";

export type UserRole = "admin" | "user";

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: UserRole;
};

export const AUTH_COOKIE_NAME = "kanban_auth";
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function getJwtSecret() {
  const value = process.env.JWT_SECRET;
  if (!value) {
    throw new Error("Missing JWT_SECRET env var");
  }
  return value;
}

export async function createAuthToken(user: AuthUser): Promise<string> {
  return signJwt(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    TOKEN_TTL_SECONDS,
    getJwtSecret(),
  );
}

export async function verifyAuthToken(token: string): Promise<AuthUser | null> {
  const payload = await verifyJwt(token, getJwtSecret());
  if (!payload) return null;
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    role: payload.role,
  };
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

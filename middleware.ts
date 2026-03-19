import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { verifyJwtHs256 } from "@/lib/jwt-edge";

const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/api/webhook",
  "/api/auth/login",
  "/api/auth/register",
]);

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon.ico")) return true;
  if (pathname.startsWith("/api/discord")) return true;

  const hasExtension = /\.[a-zA-Z0-9]+$/.test(pathname);
  if (hasExtension) return true;

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = await verifyJwtHs256(token, JWT_SECRET);
  if (!payload?.sub || !payload?.role) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Block non-admins from settings page
  if (pathname === "/settings" && payload.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};

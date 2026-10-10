import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { AUTH_COOKIE } from "@/lib/constants";

/**
 * Edge middleware: first line of defence. Rejects unauthenticated API calls with 401 JSON,
 * redirects unauthenticated page visits to /login, and keeps authors out of /admin (and vice versa).
 * Route handlers re-check role + ownership, so this is defence in depth rather than the only gate.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  if (pathname === "/api/auth/login" || pathname === "/api/auth/logout") return NextResponse.next();

  let role: string | null = null;
  const token = req.cookies.get(AUTH_COOKIE)?.value ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (token && process.env.JWT_SECRET) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
      role = String(payload.role);
    } catch {
      role = null;
    }
  }

  if (!role) {
    if (isApi) {
      return NextResponse.json({ error: { code: "unauthorized", message: "Authentication required" } }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (!isApi) {
    if (pathname.startsWith("/admin") && role !== "admin") return NextResponse.redirect(new URL("/author/books", req.url));
    if (pathname.startsWith("/author") && role !== "author") return NextResponse.redirect(new URL("/admin", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*", "/author/:path*", "/admin/:path*"] };

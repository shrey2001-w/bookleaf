import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";
import { AUTH_COOKIE, Role } from "./constants";
import { forbidden, unauthorized } from "./api";

export interface Session {
  sub: string; // user _id
  role: Role;
  name: string;
  email: string;
}

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error("JWT_SECRET must be set (min 16 chars)");
  return new TextEncoder().encode(s);
};

export async function signToken(session: Session): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifyToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

/** Authenticate the request (cookie or Bearer token) and optionally enforce a role. */
export async function requireSession(req: NextRequest, ...roles: Role[]): Promise<Session> {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const session = await verifyToken(req.cookies.get(AUTH_COOKIE)?.value ?? bearer);
  if (!session) throw unauthorized();
  if (roles.length && !roles.includes(session.role)) throw forbidden();
  return session;
}

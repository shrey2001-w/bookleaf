export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { route, parseBody, ApiError } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { User } from "@/models/User";
import { signToken } from "@/lib/auth";
import { AUTH_COOKIE } from "@/lib/constants";

// Real hash computed once so response time is constant when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export const POST = route(async (req) => {
  const { email, password } = await parseBody(req, loginSchema);
  const user = await User.findOne({ email }).select("+passwordHash");
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw new ApiError(401, "invalid_credentials", "Incorrect email or password");

  const token = await signToken({ sub: String(user._id), role: user.role, name: user.name, email: user.email });
  const res = NextResponse.json({ user: { id: String(user._id), name: user.name, email: user.email, role: user.role } });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
});

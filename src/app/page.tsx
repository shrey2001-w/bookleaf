import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import { AUTH_COOKIE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await verifyToken(cookies().get(AUTH_COOKIE)?.value);
  if (!session) redirect("/login");
  redirect(session.role === "admin" ? "/admin" : "/author/books");
}

export const dynamic = "force-dynamic";
import { route, json } from "@/lib/api";
import { requireSession } from "@/lib/auth";

export const GET = route(async (req) => {
  const s = await requireSession(req);
  return json({ user: { id: s.sub, name: s.name, email: s.email, role: s.role } });
});

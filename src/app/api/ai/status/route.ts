export const dynamic = "force-dynamic";
import { route, json } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { aiStatus, aiSelfTest } from "@/lib/ai/llm";

/** Lets the UI show whether AI is live. Provider/model details are admin-only. */
export const GET = route(async (req) => {
  const s = await requireSession(req);
  const st = aiStatus();
  // Admin-only live test: GET /api/ai/status?test=1
  if (s.role === "admin" && req.nextUrl.searchParams.get("test")) return json({ ...st, test: await aiSelfTest() });
  return json(s.role === "admin" ? st : { enabled: st.enabled });
});

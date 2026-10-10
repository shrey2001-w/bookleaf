"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { CATEGORIES, PRIORITIES, STATUSES, OVERDUE_HOURS, isClosedStatus } from "@/lib/constants";
import { ageHours, api, errMsg, timeAgo } from "@/lib/client";
import { btn, Card, Empty, ErrorBox, input, PageTitle, PriorityBadge, Spinner, StatusBadge, Tag } from "@/components/ui";
import type { AiStatusDTO, TicketDTO } from "@/types";

interface Res { tickets: TicketDTO[]; counts: Record<string, number> }
const EMPTY = { status: "", category: "", priority: "", assigned: "", from: "", to: "", q: "" };

export default function QueuePage() {
  const router = useRouter();
  const [f, setF] = useState(EMPTY);
  const url = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    return `/api/tickets?${p}`;
  }, [f]);
  const { data, error, loading } = usePolling<Res>(url, 10000);
  const { data: ai } = usePolling<AiStatusDTO>("/api/ai/status");
  const [aiTest, setAiTest] = useState<string | null>(null);
  async function testAi() {
    setAiTest("Testing…");
    try {
      const r = await api<AiStatusDTO & { test: { ok: boolean; error?: string } }>("/api/ai/status?test=1");
      setAiTest(r.test.ok ? "AI test passed ✓ — the model replied." : `AI test failed: ${r.test.error}`);
    } catch (e) { setAiTest(errMsg(e)); }
  }
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const filtered = Object.values(f).some(Boolean);
  const counts = data?.counts ?? {};

  return (
    <>
      <PageTitle title="Ticket queue" hint="Unresolved tickets are sorted by priority, then oldest first. The list refreshes every 10 seconds." action={ai && (ai.enabled ? <Tag tone="leaf">AI on · {ai.provider} {ai.model}</Tag> : <Tag tone="red">AI off · keyword fallback (add an API key)</Tag>)} />
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <button className={btn.secondary} onClick={testAi}>Test AI connection</button>
        {aiTest && <span className={aiTest.startsWith("AI test passed") ? "text-emerald-700" : aiTest === "Testing…" ? "text-slate-500" : "text-red-700"}>{aiTest}</span>}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setF({ ...f, status: f.status === s ? "" : s })} className={`rounded-md border px-3 py-1.5 text-sm ${f.status === s ? "border-leaf bg-leaf-soft" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
            {s} <span className="ml-1 font-semibold">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <select aria-label="Category" className={input} value={f.category} onChange={set("category")}>
          <option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select aria-label="Priority" className={input} value={f.priority} onChange={set("priority")}>
          <option value="">All priorities</option>{PRIORITIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select aria-label="Assignment" className={input} value={f.assigned} onChange={set("assigned")}>
          <option value="">Anyone</option><option value="me">Assigned to me</option><option value="unassigned">Unassigned</option>
        </select>
        <input aria-label="From date" type="date" className={input} value={f.from} onChange={set("from")} />
        <input aria-label="To date" type="date" className={input} value={f.to} onChange={set("to")} />
        <input aria-label="Search subject" placeholder="Search subject…" className={input} value={f.q} onChange={set("q")} />
      </Card>
      {filtered && <button className="mb-3 text-sm text-leaf-dark underline" onClick={() => setF(EMPTY)}>Clear filters</button>}

      {loading ? <Spinner /> : error ? <ErrorBox message={error} /> : !data?.tickets.length ? (
        <Empty title={filtered ? "No tickets match these filters" : "The queue is empty"} hint={filtered ? "Try removing a filter." : "New author queries will appear here automatically."} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <tr>{["Priority", "Ticket", "Author", "Category", "Status", "Assigned", "Age", ""].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.tickets.map((t) => {
                const overdue = !isClosedStatus(t.status) && ageHours(t.createdAt) > OVERDUE_HOURS;
                const closed = isClosedStatus(t.status);
                return (
                  <tr key={t.id} onClick={() => router.push(`/admin/tickets/${t.id}`)} className={`cursor-pointer hover:bg-slate-50 ${closed ? "opacity-60" : ""} ${t.priority === "Critical" && !closed ? "bg-red-50/50" : ""}`}>
                    <td className="px-4 py-3"><PriorityBadge p={t.priority} /></td>
                    <td className="max-w-xs px-4 py-3">
                      <Link href={`/admin/tickets/${t.id}`} className="font-medium text-ink hover:underline">{t.subject}</Link>
                      <div className="text-xs text-slate-500">{t.ref} · {t.book?.title ?? "General"}</div>
                    </td>
                    <td className="px-4 py-3">{t.author?.name}</td>
                    <td className="px-4 py-3">
                      <span>{t.category}</span>{" "}
                      {t.categorySource === "admin" && <Tag>edited</Tag>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge s={t.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{t.assignedTo?.name ?? <span className="text-slate-400">Unassigned</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {timeAgo(t.createdAt)} {overdue && <Tag tone="red">Overdue</Tag>}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/tickets/${t.id}`} onClick={(e) => e.stopPropagation()} className={`${btn.secondary} whitespace-nowrap`}>Open &amp; reply</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

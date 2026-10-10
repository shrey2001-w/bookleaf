"use client";
import Link from "next/link";
import { useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { api, errMsg, fmtDateTime } from "@/lib/client";
import { btn, ErrorBox, input, PriorityBadge, Spinner, StatusBadge, Tag } from "@/components/ui";
import Thread from "@/components/Thread";
import type { TicketDTO } from "@/types";

export default function TicketPage({ params }: { params: { id: string } }) {
  const { data, error, loading, setData } = usePolling<{ ticket: TicketDTO }>(`/api/tickets/${params.id}`, 4000);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? "Ticket not found"} />;
  const t = data.ticket;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSendErr(null);
    try {
      const r = await api<{ ticket: TicketDTO }>(`/api/tickets/${t.id}/messages`, { method: "POST", json: { body: reply } });
      setData(r);
      setReply("");
    } catch (err) {
      setSendErr(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <Link href="/author/tickets" className="text-sm text-slate-600 hover:underline">← All tickets</Link>
      <div className="mb-6 mt-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-2xl">{t.subject}</h1>
          <StatusBadge s={t.status} />
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          {t.ref} · {t.book?.title ?? "General / Account Level"} · opened {fmtDateTime(t.createdAt)} <Tag tone="leaf">{t.category}</Tag> <PriorityBadge p={t.priority} />
        </p>
      </div>
      <Thread ticket={t} viewer="author" />
      {t.messages.every((m) => m.sender !== "admin") && (
        <p className="mt-4 rounded-md bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">We&apos;ve received your query. Our team will reply here; this page refreshes automatically.</p>
      )}
      {t.status === "Closed" ? (
        <p className="mt-6 text-sm text-slate-600">This ticket is closed. <Link href="/author/tickets/new" className="text-leaf-dark underline">Open a new query</Link> if you need more help.</p>
      ) : (
        <form onSubmit={send} className="mt-6 space-y-3">
          {sendErr && <ErrorBox message={sendErr} />}
          <label className="block text-sm font-medium">{t.status === "Resolved" ? "Not resolved? Reply to reopen" : "Add a reply"}
            <textarea className={`${input} mt-1 min-h-[90px]`} required maxLength={5000} value={reply} onChange={(e) => setReply(e.target.value)} />
          </label>
          <button className={btn.primary} disabled={busy || !reply.trim()}>{busy ? "Sending…" : "Send reply"}</button>
        </form>
      )}
    </div>
  );
}

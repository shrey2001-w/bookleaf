"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { api, errMsg, fmtDateTime, inr, fmtDate } from "@/lib/client";
import { CATEGORIES, PRIORITIES, STATUSES } from "@/lib/constants";
import { btn, Card, ErrorBox, input, Spinner, Tag } from "@/components/ui";
import Thread from "@/components/Thread";
import type { BookDTO, DraftDTO, SummaryDTO, TicketDTO } from "@/types";

export default function AdminTicketPage({ params }: { params: { id: string } }) {
  const { data, error, loading, setData, reload } = usePolling<{ ticket: TicketDTO }>(`/api/tickets/${params.id}`, 8000);
  const [draft, setDraft] = useState("");
  const [draftMeta, setDraftMeta] = useState<DraftDTO | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftErr, setDraftErr] = useState<string | null>(null);
  const [closeWith, setCloseWith] = useState("");
  const [sending, setSending] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const dirty = useRef(false); // true once the admin edits the draft, so we never overwrite their work
  const requested = useRef(false);
  const [book, setBook] = useState<BookDTO | null>(null);
  const [summary, setSummary] = useState<SummaryDTO | null>(null);
  const [sumBusy, setSumBusy] = useState(false);

  const loadDraft = useCallback(async (regenerate = false) => {
    setDraftBusy(true);
    setDraftErr(null);
    try {
      const { draft } = await api<{ draft: DraftDTO }>(`/api/tickets/${params.id}/draft`, { method: "POST", json: { regenerate } });
      setDraft(draft.text);
      setDraftMeta(draft);
      dirty.current = false;
    } catch (e) {
      setDraftErr(errMsg(e));
    } finally {
      setDraftBusy(false);
    }
  }, [params.id]);

  // Generate (or load the cached) draft once, when the admin first opens the ticket.
  useEffect(() => {
    if (data && !requested.current) { requested.current = true; loadDraft(false); }
  }, [data, loadDraft]);

  // Book facts for the context panel (admin /api/books supports ?authorId=).
  const authorId = data?.ticket.author?.id;
  const bookId = data?.ticket.book?.id;
  useEffect(() => {
    if (!authorId || !bookId) return;
    api<{ books: BookDTO[] }>(`/api/books?authorId=${authorId}`).then((r) => setBook(r.books.find((b) => b.id === bookId) ?? null)).catch(() => {});
  }, [authorId, bookId]);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? "Ticket not found"} />;
  const t = data.ticket;

  async function patch(body: Record<string, unknown>, redraft = false) {
    setActionErr(null);
    try {
      const r = await api<{ ticket: TicketDTO }>(`/api/tickets/${t.id}`, { method: "PATCH", json: body });
      setData(r);
      if (redraft && !dirty.current) loadDraft(true); // category changed -> different policy context
    } catch (e) { setActionErr(errMsg(e)); }
  }

  async function sendReply() {
    setSending(true);
    setActionErr(null);
    try {
      const r = await api<{ ticket: TicketDTO }>(`/api/tickets/${t.id}/messages`, { method: "POST", json: { body: draft, ...(closeWith ? { status: closeWith } : {}) } });
      setData(r);
      setDraft("");
      setDraftMeta(null);
      setCloseWith("");
    } catch (e) { setActionErr(errMsg(e)); } finally { setSending(false); }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await api<{ ticket: TicketDTO }>(`/api/tickets/${t.id}/notes`, { method: "POST", json: { body: note } });
      setData(r);
      setNote("");
    } catch (err) { setActionErr(errMsg(err)); }
  }

  async function summarize() {
    setSumBusy(true);
    try {
      const r = await api<{ summary: SummaryDTO }>(`/api/tickets/${t.id}/summary`, { method: "POST" });
      setSummary(r.summary);
    } catch (e) { setActionErr(errMsg(e)); } finally { setSumBusy(false); }
  }

  async function reclassify() {
    try {
      const r = await api<{ ticket: TicketDTO }>(`/api/tickets/${t.id}/classify`, { method: "POST" });
      setData(r);
      loadDraft(true);
    } catch (e) { setActionErr(errMsg(e)); }
  }

  const sourceLabel = (s?: string) => (s === "ai" ? "AI" : s === "fallback" ? "keyword fallback" : s === "admin" ? "set by admin" : "pending");

  return (
    <div>
      <Link href="/admin" className="text-sm text-slate-600 hover:underline">← Ticket queue</Link>
      <div className="mb-6 mt-3">
        <h1 className="font-serif text-2xl">{t.subject}</h1>
        <p className="mt-1 text-sm text-slate-600">{t.ref} · from {t.author?.name} ({t.author?.email}) · opened {fmtDateTime(t.createdAt)}</p>
      </div>
      {actionErr && <div className="mb-4"><ErrorBox message={actionErr} /></div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="grid gap-4 p-4 sm:grid-cols-3">
            <Field label="Status">
              <select className={input} value={t.status} onChange={(e) => patch({ status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
            </Field>
            <Field label="Category" hint={`Classified by ${sourceLabel(t.categorySource)}`}>
              <select className={input} value={t.category} onChange={(e) => patch({ category: e.target.value }, true)}>{CATEGORIES.map((s) => <option key={s}>{s}</option>)}</select>
            </Field>
            <Field label="Priority" hint={`Scored by ${sourceLabel(t.prioritySource)}`}>
              <select className={input} value={t.priority} onChange={(e) => patch({ priority: e.target.value })}>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select>
            </Field>
            {t.classificationReason && <p className="text-xs text-slate-500 sm:col-span-3">AI rationale: {t.classificationReason} <button className="ml-2 text-leaf-dark underline" onClick={reclassify}>Re-run AI triage</button></p>}
            <div className="flex items-center gap-3 text-sm sm:col-span-3">
              <span className="text-slate-600">Assigned to: <strong>{t.assignedTo?.name ?? "nobody"}</strong></span>
              <button className={btn.secondary} onClick={() => patch({ assignee: "me" })}>Assign to me</button>
              {t.assignedTo && <button className="text-slate-600 underline" onClick={() => patch({ assignee: null })}>Unassign</button>}
            </div>
          </Card>

          <Thread ticket={t} viewer="admin" />

          <Card className="p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">Reply to author</h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {draftMeta && <Tag tone={draftMeta.source === "ai" ? "leaf" : "slate"}>{draftMeta.source === "ai" ? `AI draft${draftMeta.cached ? " (saved)" : ""}` : "Template draft"}</Tag>}
                <button className="text-leaf-dark underline disabled:opacity-50" disabled={draftBusy} onClick={() => loadDraft(true)}>Regenerate</button>
              </div>
            </div>
            {draftMeta?.source === "template" && <p className="mb-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">The AI service is unavailable, so this is a policy-based template. Fill in the [ADMIN: …] parts or write your own reply.</p>}
            {draftErr && <ErrorBox message={draftErr} />}
            {draftBusy ? <Spinner label="Drafting a response from the knowledge base…" /> : (
              <textarea className={`${input} min-h-[260px] font-[inherit] leading-relaxed`} value={draft} placeholder="Write your reply to the author…" onChange={(e) => { dirty.current = true; setDraft(e.target.value); }} />
            )}
            {/\[ADMIN:/.test(draft) && <p className="mt-2 text-xs text-red-700">The draft still contains [ADMIN: …] placeholders. Replace them before sending.</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button className={btn.primary} disabled={sending || !draft.trim()} onClick={sendReply}>{sending ? "Sending…" : "Send reply"}</button>
              <label className="flex items-center gap-2 text-sm text-slate-600">After sending:
                <select className="rounded-md border border-slate-300 px-2 py-1 text-sm" value={closeWith} onChange={(e) => setCloseWith(e.target.value)}>
                  <option value="">Default (move to In Progress)</option>
                  <option>Resolved</option><option>Closed</option>
                </select>
              </label>
            </div>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="p-4 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-medium">AI summary</h2>
              <button className="text-leaf-dark underline disabled:opacity-50" disabled={sumBusy} onClick={summarize}>{sumBusy ? "Summarising…" : summary ? "Refresh" : "Summarise"}</button>
            </div>
            {summary ? (
              <>
                <p className="whitespace-pre-wrap leading-relaxed">{summary.text}</p>
                {summary.source === "fallback" && <p className="mt-2 text-xs text-slate-500">AI unavailable; showing the start of the author&apos;s message.</p>}
              </>
            ) : <p className="text-slate-500">A short brief of the issue, what&apos;s been done and what&apos;s pending.</p>}
          </Card>
          <Card className="p-4 text-sm">
            <h2 className="mb-2 font-medium">Book</h2>
            {!t.book ? <p className="text-slate-600">General / Account Level query.</p> : (
              <dl className="space-y-1">
                <div className="font-medium">{t.book.title}</div>
                <Row k="ISBN" v={t.book.isbn ?? "Not assigned"} />
                {book && (<>
                  <Row k="Status" v={book.status === "Published" ? "Published" : `In production: ${book.productionStage}`} />
                  <Row k="Published" v={fmtDate(book.publicationDate)} />
                  <Row k="Copies sold" v={String(book.copiesSold)} />
                  <Row k="Royalty earned" v={inr(book.royaltyEarned)} />
                  <Row k="Paid / pending" v={`${inr(book.royaltyPaid)} / ${inr(book.royaltyPending)}`} />
                  {book.platforms.some((p) => !p.available) && <Row k="Unavailable on" v={book.platforms.filter((p) => !p.available).map((p) => p.name).join(", ")} />}
                </>)}
              </dl>
            )}
          </Card>

          <Card className="p-4 text-sm">
            <h2 className="mb-1 font-medium">Internal notes</h2>
            <p className="mb-3 text-xs text-slate-500">Only visible to the BookLeaf team.</p>
            <ul className="mb-3 space-y-3">
              {t.internalNotes?.length ? t.internalNotes.map((n) => (
                <li key={n.id} className="rounded-md bg-amber-50 px-3 py-2">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-500">{n.authorName} · {fmtDateTime(n.createdAt)}</p>
                </li>
              )) : <li className="text-slate-500">No notes yet.</li>}
            </ul>
            <form onSubmit={addNote} className="space-y-2">
              <textarea className={`${input} min-h-[70px]`} required maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Checked with finance, payout queued for 12 Nov" />
              <button className={btn.secondary} disabled={!note.trim()}>Add note</button>
            </form>
          </Card>
        </aside>
      </div>
      <button className="mt-6 text-xs text-slate-400 underline" onClick={() => reload()}>Refresh now</button>
    </div>
  );
}

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="block text-sm font-medium">{label}<div className="mt-1">{children}</div>{hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}</label>
);
const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="text-right">{v}</dd></div>
);

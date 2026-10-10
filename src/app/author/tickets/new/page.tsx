"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { api, errMsg } from "@/lib/client";
import { btn, Card, ErrorBox, input, PageTitle, Tag } from "@/components/ui";
import type { AssistDTO, BookDTO, TicketDTO } from "@/types";

export default function NewTicketPage() {
  const router = useRouter();
  const { data } = usePolling<{ books: BookDTO[] }>("/api/books");
  const [bookId, setBookId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState<AssistDTO | null>(null);
  const [helpBusy, setHelpBusy] = useState(false);
  const [helpErr, setHelpErr] = useState<string | null>(null);

  /** Optional pre-submit help: answers from policy + the author's own data, which may save them a wait. */
  async function getHelp() {
    setHelpBusy(true);
    setHelpErr(null);
    try {
      setHelp(await api<AssistDTO>("/api/ai/assist", { method: "POST", json: { bookId: bookId || null, message: `${subject}\n${description}`.trim() } }));
    } catch (err) {
      setHelpErr(errMsg(err));
    } finally {
      setHelpBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { ticket } = await api<{ ticket: TicketDTO }>("/api/tickets", {
        method: "POST",
        // Attachments are UI-only for now: we record file names, not file contents.
        json: { bookId: bookId || null, subject, description, attachments: files.map((f) => ({ name: f.name })) },
      });
      router.push(`/author/tickets/${ticket.id}`);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageTitle title="Submit a support query" hint="Tell us what's happening. The more detail you share, the faster we can help." />
      <Card className="p-6">
        <form onSubmit={submit} className="space-y-5">
          {error && <ErrorBox message={error} />}
          <label className="block text-sm font-medium">Which book is this about?
            <select className={`${input} mt-1`} value={bookId} onChange={(e) => setBookId(e.target.value)}>
              <option value="">General / Account Level</option>
              {data?.books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Subject
            <input className={`${input} mt-1`} required minLength={3} maxLength={150} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Royalty for Q2 not received" />
          </label>
          <label className="block text-sm font-medium">Description
            <textarea className={`${input} mt-1 min-h-[160px]`} required minLength={10} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened, when did you notice it, and what would you like us to do?" />
            <span className="mt-1 block text-right text-xs text-slate-500">{description.length}/5000</span>
          </label>
          <div className="text-sm">
            <label className="block font-medium">Attachments <span className="font-normal text-slate-500">(optional, up to 5)</span>
              <input type="file" multiple className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))} />
            </label>
            <p className="mt-1 text-xs text-slate-500">For print-quality issues, photos of the defective pages help. File names are attached to your ticket; uploads aren&apos;t stored yet.</p>
          </div>
          <div className="rounded-md border border-dashed border-leaf/50 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-slate-700">Want a quick answer first? BookLeaf AI can check policy and your account data.</span>
              <button type="button" className={btn.secondary} disabled={helpBusy || `${subject} ${description}`.trim().length < 10} onClick={getHelp}>
                {helpBusy ? "Checking…" : "Get instant help"}
              </button>
            </div>
            {helpErr && <div className="mt-3"><ErrorBox message={helpErr} /></div>}
            {help && (
              <div className="mt-3 rounded-md bg-leaf-soft px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center gap-2"><Tag tone="leaf">AI suggestion</Tag><Tag>{help.category}</Tag></div>
                {help.answer ? (
                  <>
                    <p className="whitespace-pre-wrap leading-relaxed">{help.answer}</p>
                    <p className="mt-2 text-xs text-slate-600">{help.needsHuman ? "This needs our team to look into it, so please submit your query." : "If this doesn't answer your question, submit your query and we'll follow up."}</p>
                  </>
                ) : (
                  <p>AI help isn&apos;t available right now. You can still submit your query and our team will reply.</p>
                )}
              </div>
            )}
          </div>
          <button className={btn.primary} disabled={busy}>{busy ? "Submitting…" : "Submit query"}</button>
        </form>
      </Card>
    </div>
  );
}

"use client";
import Link from "next/link";
import { useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { api, errMsg } from "@/lib/client";
import { btn, Card, ErrorBox, input, PageTitle, Tag } from "@/components/ui";
import type { AssistDTO, BookDTO } from "@/types";

const SUGGESTIONS = [
  "When will I receive my royalty?",
  "How is my royalty calculated?",
  "How long does printing take?",
  "Can I update my book description after it's live?",
  "My book shows as unavailable on Amazon. What happens now?",
];

interface Entry { question: string; result: AssistDTO }

export default function AssistantPage() {
  const { data } = usePolling<{ books: BookDTO[] }>("/api/books");
  const [bookId, setBookId] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);

  async function ask(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<AssistDTO>("/api/ai/assist", { method: "POST", json: { message: question, bookId: bookId || null } });
      setHistory([{ question, result }, ...history]);
      setQuestion("");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageTitle title="Ask BookLeaf AI" hint="Instant answers about royalties, ISBNs, printing, availability and your book's progress, based on BookLeaf policy and your own account data." />
      <Card className="p-5">
        <form onSubmit={ask} className="space-y-4">
          {error && <ErrorBox message={error} />}
          <label className="block text-sm font-medium">About which book? <span className="font-normal text-slate-500">(optional)</span>
            <select className={`${input} mt-1`} value={bookId} onChange={(e) => setBookId(e.target.value)}>
              <option value="">All my books / general</option>
              {data?.books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">Your question
            <textarea className={`${input} mt-1 min-h-[100px]`} required minLength={5} maxLength={2000} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. I sold 200 copies but only received ₹3,000. Why?" />
          </label>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button type="button" key={s} onClick={() => setQuestion(s)} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50">{s}</button>
            ))}
          </div>
          <button className={btn.primary} disabled={busy || question.trim().length < 5}>{busy ? "Thinking…" : "Ask"}</button>
        </form>
      </Card>

      <div className="mt-6 space-y-4">
        {history.map((h, i) => (
          <Card key={i} className="p-5">
            <p className="text-sm font-medium">{h.question}</p>
            <div className="mt-3 rounded-md bg-leaf-soft px-4 py-3 text-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2"><Tag tone="leaf">BookLeaf AI</Tag><Tag>{h.result.category}</Tag></div>
              {h.result.answer ? <p className="whitespace-pre-wrap leading-relaxed">{h.result.answer}</p> : <p>The AI assistant isn&apos;t available right now. Please raise a query and our team will reply.</p>}
            </div>
            {(h.result.needsHuman || !h.result.answer) && (
              <p className="mt-3 text-sm text-slate-600">
                This needs our team to look into it. <Link className="text-leaf-dark underline" href="/author/tickets/new">Raise a support query</Link>
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

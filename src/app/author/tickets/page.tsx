"use client";
import Link from "next/link";
import { usePolling } from "@/hooks/usePolling";
import { Card, Empty, ErrorBox, PageTitle, Spinner, StatusBadge } from "@/components/ui";
import { timeAgo } from "@/lib/client";
import type { TicketDTO } from "@/types";

export default function MyTicketsPage() {
  const { data, error, loading } = usePolling<{ tickets: TicketDTO[] }>("/api/tickets", 5000);
  if (loading) return <Spinner />;
  const tickets = data?.tickets ?? [];
  return (
    <>
      <PageTitle title="My tickets" hint="This page updates automatically when our team replies." action={<Link href="/author/tickets/new" className="rounded-md bg-leaf px-4 py-2 text-sm font-medium text-white hover:bg-leaf-dark">New query</Link>} />
      {error && <ErrorBox message={error} />}
      {tickets.length === 0 ? (
        <Empty title="You haven't raised any queries" hint="Questions about royalties, ISBNs, printing or your book's status? Raise a ticket and we'll respond." action={<Link href="/author/tickets/new" className="text-leaf-dark underline">Raise your first query</Link>} />
      ) : (
        <ul className="space-y-3">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/author/tickets/${t.id}`}>
                <Card className="p-4 transition-colors hover:border-leaf">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-medium">{t.subject}</h2>
                    <StatusBadge s={t.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{t.description}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {t.ref} · {t.category} · {t.book?.title ?? "General / Account Level"} · opened {timeAgo(t.createdAt)}
                    {t.messages.some((m) => m.sender === "admin") ? ` · ${t.messages.filter((m) => m.sender === "admin").length} repl${t.messages.filter((m) => m.sender === "admin").length > 1 ? "ies" : "y"} from BookLeaf` : " · awaiting reply"}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

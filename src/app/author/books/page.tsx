"use client";
import { usePolling } from "@/hooks/usePolling";
import { Card, Empty, ErrorBox, PageTitle, Spinner, Tag } from "@/components/ui";
import { fmtDate, inr } from "@/lib/client";
import type { BookDTO } from "@/types";
import Link from "next/link";

interface Res { books: BookDTO[]; nextPayout: { quarterEnd: string; deadline: string } }

export default function BooksPage() {
  const { data, error, loading } = usePolling<Res>("/api/books");
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  const books = data?.books ?? [];
  const published = books.filter((b) => b.status === "Published");
  const sum = (k: "royaltyEarned" | "royaltyPaid" | "royaltyPending") => published.reduce((n, b) => n + b[k], 0);

  return (
    <>
      <PageTitle
        title="My books"
        hint={data ? `Royalties are paid within 45 days of each quarter end. Next payout deadline: ${fmtDate(data.nextPayout.deadline)}.` : undefined}
        action={<Link href="/author/tickets/new" className="rounded-md bg-leaf px-4 py-2 text-sm font-medium text-white hover:bg-leaf-dark">Raise a query</Link>}
      />
      {books.length === 0 ? (
        <Empty title="No books on your account yet" hint="Once your manuscript is received, it will appear here with its production progress." />
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {[["Total royalty earned", sum("royaltyEarned")], ["Royalty paid", sum("royaltyPaid")], ["Royalty pending", sum("royaltyPending")]].map(([l, v]) => (
              <Card key={l as string} className="px-4 py-3">
                <p className="text-xs text-slate-500">{l}</p>
                <p className="font-serif text-2xl">{inr(v as number)}</p>
              </Card>
            ))}
          </div>
          <div className="space-y-4">
            {books.map((b) => (
              <Card key={b.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-serif text-lg">{b.title}</h2>
                    <p className="text-sm text-slate-600">{b.genre} · ISBN {b.isbn ?? "assigned at the ISBN stage"}</p>
                  </div>
                  <Tag tone={b.status === "Published" ? "leaf" : "slate"}>{b.status === "Published" ? "Published" : `In production: ${b.productionStage}`}</Tag>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                  <Stat label="Publication date" value={b.publicationDate ? fmtDate(b.publicationDate) : "Not yet published"} />
                  <Stat label="MRP" value={inr(b.mrp)} />
                  <Stat label="Copies sold" value={b.status === "Published" ? b.copiesSold.toLocaleString("en-IN") : "—"} />
                  <Stat label="Royalty earned" value={b.status === "Published" ? inr(b.royaltyEarned) : "—"} />
                  <Stat label="Royalty paid" value={b.status === "Published" ? inr(b.royaltyPaid) : "—"} />
                  <Stat label="Royalty pending" value={b.status === "Published" ? inr(b.royaltyPending) : "—"} />
                  {b.status === "Published" && b.royaltyPaid === 0 && b.royaltyPending > 0 && (
                    <div className="col-span-2 text-xs text-slate-600">
                      {b.royaltyPending < 1000 ? "Pending is below the ₹1,000 minimum payout, so it rolls over to the next quarter." : "Pending royalty will be paid in the next quarterly payout."}
                    </div>
                  )}
                </dl>
                {b.status === "Published" && b.platforms.some((p) => !p.available) && (
                  <p className="mt-3 text-sm text-orange-800">
                    Unavailable on: {b.platforms.filter((p) => !p.available).map((p) => p.name).join(", ")}.{" "}
                    <Link href="/author/tickets/new" className="underline">Report it</Link>
                  </p>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div><dt className="text-xs text-slate-500">{label}</dt><dd className="font-medium">{value}</dd></div>
);

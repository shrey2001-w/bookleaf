import type { MessageDTO, TicketDTO } from "@/types";
import { fmtDateTime } from "@/lib/client";

/** Conversation view: the original query followed by replies. `viewer` decides which side is "me". */
export default function Thread({ ticket, viewer }: { ticket: TicketDTO; viewer: "author" | "admin" }) {
  const first: MessageDTO = {
    id: "original", sender: "author", senderName: ticket.author?.name ?? "Author", body: ticket.description, createdAt: ticket.createdAt,
  };
  return (
    <ol className="space-y-4">
      {[first, ...ticket.messages].map((m) => {
        const mine = m.sender === viewer;
        return (
          <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${m.sender === "admin" ? "bg-leaf-soft text-ink" : "border border-slate-200 bg-white text-ink"}`}>
              <div className="mb-1 flex flex-wrap gap-x-2 text-xs text-slate-500">
                <span className="font-medium text-slate-700">{m.sender === "admin" ? `${m.senderName} · BookLeaf Support` : m.senderName}</span>
                <span>{fmtDateTime(m.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
              {m.id === "original" && ticket.attachments.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">Attachments: {ticket.attachments.map((a) => a.name).join(", ")}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

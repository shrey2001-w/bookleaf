import type { ReactNode } from "react";
import type { Priority, Status } from "@/lib/constants";

const PRIORITY_STYLE: Record<Priority, string> = {
  Critical: "bg-red-600 text-white",
  High: "bg-orange-100 text-orange-800 ring-1 ring-orange-300",
  Medium: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  Low: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};
const STATUS_STYLE: Record<Status, string> = {
  Open: "bg-blue-50 text-blue-800 ring-1 ring-blue-200",
  "In Progress": "bg-violet-50 text-violet-800 ring-1 ring-violet-200",
  Resolved: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  Closed: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};
const pill = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

export const PriorityBadge = ({ p }: { p: Priority }) => <span className={`${pill} ${PRIORITY_STYLE[p]}`}>{p}</span>;
export const StatusBadge = ({ s }: { s: Status }) => <span className={`${pill} ${STATUS_STYLE[s]}`}>{s}</span>;
export const Tag = ({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "leaf" | "red" }) => (
  <span className={`${pill} ${tone === "leaf" ? "bg-leaf-soft text-leaf-dark" : tone === "red" ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-slate-100 text-slate-700"}`}>{children}</span>
);

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-lg border border-slate-200 bg-white ${className}`}>{children}</div>
);

export const PageTitle = ({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="font-serif text-2xl text-ink">{title}</h1>
      {hint && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
    </div>
    {action}
  </div>
);

export const Spinner = ({ label = "Loading…" }: { label?: string }) => (
  <div className="flex items-center gap-2 py-10 text-sm text-slate-500" role="status">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-leaf" /> {label}
  </div>
);

export const ErrorBox = ({ message }: { message: string }) => (
  <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</div>
);

export const Empty = ({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) => (
  <Card className="px-6 py-12 text-center">
    <p className="font-medium text-ink">{title}</p>
    {hint && <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{hint}</p>}
    {action && <div className="mt-4">{action}</div>}
  </Card>
);

export const btn = {
  primary: "inline-flex items-center justify-center rounded-md bg-leaf px-4 py-2 text-sm font-medium text-white hover:bg-leaf-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:cursor-not-allowed disabled:opacity-50",
  secondary: "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
};
export const input = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30";

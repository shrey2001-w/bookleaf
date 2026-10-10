/**
 * Royalty timing helper: royalties are calculated quarterly and paid within 45 days of quarter end.
 * Returns the next payout deadline relative to `now`, used both in AI context and the UI.
 */
export function nextPayoutInfo(now: Date = new Date()) {
  const quarterEnds = [2, 5, 8, 11].map((m) => (y: number) => new Date(Date.UTC(y, m + 1, 0))); // Mar31, Jun30, Sep30, Dec31
  const candidates: Date[] = [];
  for (const y of [now.getUTCFullYear() - 1, now.getUTCFullYear(), now.getUTCFullYear() + 1]) {
    for (const q of quarterEnds) candidates.push(q(y));
  }
  candidates.sort((a, b) => a.getTime() - b.getTime());
  const lastEnd = [...candidates].reverse().find((d) => d <= now)!;
  let quarterEnd = lastEnd;
  let deadline = new Date(quarterEnd.getTime() + 45 * 86400000);
  if (deadline < now) {
    quarterEnd = candidates.find((d) => d > now)!;
    deadline = new Date(quarterEnd.getTime() + 45 * 86400000);
  }
  return { quarterEnd, deadline };
}

export const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const inr = (n: number) => `Rs ${n.toLocaleString("en-IN")}`;

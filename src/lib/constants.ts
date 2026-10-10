export const CATEGORIES = [
  "Royalty & Payments",
  "ISBN & Metadata Issues",
  "Printing & Quality",
  "Distribution & Availability",
  "Book Status & Production Updates",
  "General Inquiry",
] as const;
export const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;
export const STATUSES = ["Open", "In Progress", "Resolved", "Closed"] as const;
export const ROLES = ["author", "admin"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Status = (typeof STATUSES)[number];
export type Role = (typeof ROLES)[number];

export const PRIORITY_RANK: Record<Priority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
export const isClosedStatus = (s: Status) => s === "Resolved" || s === "Closed";

export const AUTH_COOKIE = "bl_token";
/** Unresolved tickets older than this are flagged "overdue" in the admin queue. */
export const OVERDUE_HOURS = 48;

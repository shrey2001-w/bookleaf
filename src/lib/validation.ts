import { z } from "zod";
import { CATEGORIES, PRIORITIES, STATUSES } from "./constants";

const objectIdStr = z.string().regex(/^[a-f\d]{24}$/i, "Must be a valid id");

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required").max(200),
});

export const createTicketSchema = z.object({
  bookId: objectIdStr.nullish(), // null/undefined => General / Account Level
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(150),
  description: z.string().trim().min(10, "Please describe the issue in at least 10 characters").max(5000),
  attachments: z.array(z.object({ name: z.string().max(200) })).max(5).optional(),
});

export const updateTicketSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    category: z.enum(CATEGORIES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    assignee: z.union([z.literal("me"), z.null()]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Message cannot be empty").max(5000),
  /** Admin only: optionally move the ticket to a new status when sending (e.g. "Resolved"). */
  status: z.enum(STATUSES).optional(),
});

export const noteSchema = z.object({ body: z.string().trim().min(1, "Note cannot be empty").max(2000) });

export const draftSchema = z.object({ regenerate: z.boolean().optional() });

export const ticketQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigned: z.enum(["me", "unassigned"]).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  q: z.string().max(100).optional(),
});

export const assistSchema = z.object({
  bookId: objectIdStr.nullish(),
  message: z.string().trim().min(5, "Tell us a little more (at least 5 characters)").max(2000),
});

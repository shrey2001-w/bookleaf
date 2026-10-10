import { Schema, model, models, Model, Types } from "mongoose";
import { CATEGORIES, PRIORITIES, STATUSES, Category, Priority, Status } from "@/lib/constants";

export interface IMessage {
  _id: Types.ObjectId;
  sender: "author" | "admin";
  senderName: string;
  body: string;
  createdAt: Date;
}
export interface INote {
  _id: Types.ObjectId;
  authorName: string;
  body: string;
  createdAt: Date;
}
export interface ITicket {
  _id: Types.ObjectId;
  author: Types.ObjectId;
  book: Types.ObjectId | null; // null => General / Account Level
  subject: string;
  description: string;
  attachments: { name: string }[]; // UI-only for now (file names, no upload)
  status: Status;
  category: Category;
  priority: Priority;
  /** Who set the value: the AI, the keyword fallback, an admin override, or "pending" before classification ran. */
  categorySource: "ai" | "fallback" | "admin" | "pending";
  prioritySource: "ai" | "fallback" | "admin" | "pending";
  classificationReason: string;
  assignedTo: Types.ObjectId | null;
  messages: IMessage[];
  internalNotes: INote[];
  /** Cached draft so reopening a ticket never costs another LLM call. Invalidated when the thread changes. */
  aiDraft: { text: string; source: "ai" | "template"; model: string; generatedAt: Date } | null;
  /** Cached ops summary; reused while the thread length is unchanged. */
  aiSummary: { text: string; messageCount: number; generatedAt: Date } | null;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    sender: { type: String, enum: ["author", "admin"], required: true },
    senderName: { type: String, required: true },
    body: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
const NoteSchema = new Schema<INote>(
  { authorName: { type: String, required: true }, body: { type: String, required: true } },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const TicketSchema = new Schema<ITicket>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", default: null },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, maxlength: 5000 },
    attachments: [{ _id: false, name: String }],
    status: { type: String, enum: STATUSES, default: "Open", index: true },
    category: { type: String, enum: CATEGORIES, default: "General Inquiry", index: true },
    priority: { type: String, enum: PRIORITIES, default: "Medium", index: true },
    categorySource: { type: String, enum: ["ai", "fallback", "admin", "pending"], default: "pending" },
    prioritySource: { type: String, enum: ["ai", "fallback", "admin", "pending"], default: "pending" },
    classificationReason: { type: String, default: "" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    messages: [MessageSchema],
    internalNotes: [NoteSchema],
    aiDraft: {
      type: new Schema(
        {
          text: String,
          source: { type: String, enum: ["ai", "template"] },
          model: String,
          generatedAt: Date,
        },
        { _id: false }
      ),
      default: null,
    },
    aiSummary: {
      type: new Schema({ text: String, messageCount: Number, generatedAt: Date }, { _id: false }),
      default: null,
    },
  },
  { timestamps: true }
);
TicketSchema.index({ createdAt: -1 });

export const Ticket: Model<ITicket> = (models.Ticket as Model<ITicket>) || model<ITicket>("Ticket", TicketSchema);

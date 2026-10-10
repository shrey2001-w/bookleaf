import type { Category, Priority, Role, Status } from "@/lib/constants";

export interface UserDTO { id: string; name: string; email: string; role: Role }
export interface BookDTO {
  id: string; title: string; isbn: string | null; genre: string; publicationDate: string | null;
  status: "Published" | "In Production"; productionStage: string | null; mrp: number; copiesSold: number;
  royaltyEarned: number; royaltyPaid: number; royaltyPending: number;
  platforms: { name: string; available: boolean }[];
}
export interface MessageDTO { id: string; sender: "author" | "admin"; senderName: string; body: string; createdAt: string }
export interface NoteDTO { id: string; authorName: string; body: string; createdAt: string }
export interface TicketDTO {
  id: string; ref: string; subject: string; description: string; attachments: { name: string }[];
  status: Status; category: Category; priority: Priority;
  author: { id: string; name: string; email: string } | null;
  book: { id: string; title: string; isbn: string | null } | null;
  assignedTo: { id: string; name: string } | null;
  messages: MessageDTO[]; createdAt: string; updatedAt: string;
  // admin-only
  categorySource?: "ai" | "fallback" | "admin" | "pending";
  prioritySource?: "ai" | "fallback" | "admin" | "pending";
  classificationReason?: string;
  internalNotes?: NoteDTO[];
}
export interface DraftDTO { text: string; source: "ai" | "template"; model: string; cached: boolean }
export interface AssistDTO { category: Category; answer: string | null; needsHuman: boolean; source: "ai" | "unavailable" }
export interface AiStatusDTO { enabled: boolean; provider?: string; model?: string }
export interface SummaryDTO { text: string; source: "ai" | "fallback"; cached: boolean }

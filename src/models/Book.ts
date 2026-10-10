import { Schema, model, models, Model, Types } from "mongoose";

export interface IBook {
  _id: Types.ObjectId;
  author: Types.ObjectId;
  title: string;
  isbn: string | null; // null until the ISBN Assignment production stage
  genre: string;
  publicationDate: Date | null;
  status: "Published" | "In Production";
  productionStage: string | null; // set while In Production
  mrp: number;
  copiesSold: number;
  royaltyEarned: number;
  royaltyPaid: number;
  royaltyPending: number;
  platforms: { name: string; available: boolean }[];
}

const BookSchema = new Schema<IBook>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    isbn: { type: String, default: null },
    genre: { type: String, required: true },
    publicationDate: { type: Date, default: null },
    status: { type: String, enum: ["Published", "In Production"], required: true },
    productionStage: { type: String, default: null },
    mrp: { type: Number, required: true, min: 0 },
    copiesSold: { type: Number, default: 0, min: 0 },
    royaltyEarned: { type: Number, default: 0, min: 0 },
    royaltyPaid: { type: Number, default: 0, min: 0 },
    royaltyPending: { type: Number, default: 0, min: 0 },
    platforms: [{ _id: false, name: String, available: Boolean }],
  },
  { timestamps: true }
);

export const Book: Model<IBook> = (models.Book as Model<IBook>) || model<IBook>("Book", BookSchema);

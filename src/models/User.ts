import { Schema, model, models, Model, Types } from "mongoose";
import type { Role } from "@/lib/constants";

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  packageType: "Standard Free" | "Bestseller Breakthrough";
  country: "IN" | "US";
  bankDetailsLinked: boolean;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["author", "admin"], required: true },
    packageType: { type: String, enum: ["Standard Free", "Bestseller Breakthrough"], default: "Standard Free" },
    country: { type: String, enum: ["IN", "US"], default: "IN" },
    bankDetailsLinked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User: Model<IUser> = (models.User as Model<IUser>) || model<IUser>("User", UserSchema);

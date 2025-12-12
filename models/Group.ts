import { randomBytes } from "crypto";
import { Document, Model, Schema, model, models } from "mongoose";

export type MemberRole = "admin" | "member";

export interface GroupMember {
  _id: string;
  name: string;
  role: MemberRole;
}

export interface GroupDocument extends Document {
  name: string;
  inviteCode: string;
  createdById: string;
  createdByName: string;
  expenseTypes: string[];
  members: GroupMember[];
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

const memberSchema = new Schema<GroupMember>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    role: { type: String, enum: ["admin", "member"], default: "member" },
  },
  { _id: true }
);

const DEFAULT_TYPES = ["Food", "Housing", "Transport", "Health", "Entertainment", "Other"];

const groupSchema = new Schema<GroupDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      default: () => randomBytes(5).toString("hex"),
    },
    createdById: { type: String, required: true },
    createdByName: { type: String, required: true, trim: true, maxlength: 80 },
    expenseTypes: { type: [String], default: DEFAULT_TYPES },
    members: { type: [memberSchema], default: [] },
    currency: { type: String, default: "USD" },
  },
  {
    timestamps: true,
  }
);

groupSchema.index({ inviteCode: 1 }, { unique: true });

groupSchema.pre("validate", function ensureAdmin() {
  if (this.members.length === 0 && this.createdByName && this.createdById) {
    this.members.push({ name: this.createdByName, role: "admin" } as GroupMember);
  }
});

const Group: Model<GroupDocument> = models.Group || model<GroupDocument>("Group", groupSchema);

export default Group;

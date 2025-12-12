import { Document, Model, Schema, Types, model, models } from "mongoose";

export interface ExpenseDocument extends Document {
  groupId: Types.ObjectId;
  paidByUserId: string;
  description: string;
  amount: number;
  type: string;
  paidBy: string;
  involved: Array<{ userId: string; name: string }>;
  date: Date;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<ExpenseDocument>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true },
    paidByUserId: { type: String, required: true },
    description: { type: String, required: true, trim: true, maxlength: 180 },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, required: true, trim: true },
    paidBy: { type: String, required: true, trim: true, maxlength: 80 },
    involved: {
      type: [
        {
          userId: { type: String, required: true },
          name: { type: String, required: true },
        },
      ],
      default: [],
    },
    date: { type: Date, default: Date.now },
    note: { type: String, trim: true, maxlength: 240 },
  },
  { timestamps: true }
);

expenseSchema.index({ groupId: 1, date: -1 });

const Expense: Model<ExpenseDocument> =
  models.Expense || model<ExpenseDocument>("Expense", expenseSchema);

export default Expense;

import { Document, Model, Schema, models, model } from "mongoose";

type TransactionType = "income" | "expense";

export interface TransactionDocument extends Document {
  type: TransactionType;
  category: string;
  amount: number;
  note?: string;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<TransactionDocument>(
  {
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Transaction: Model<TransactionDocument> =
  models.Transaction || model<TransactionDocument>("Transaction", transactionSchema);

export default Transaction;

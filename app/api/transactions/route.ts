import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Transaction from "@/models/Transaction";

export async function GET() {
  try {
    await connectToDatabase();
    const transactions = await Transaction.find().sort({ date: -1 }).lean();

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error("GET /api/transactions error", error);
    return NextResponse.json(
      { error: "Failed to load transactions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, category, amount, note, date } = body;

    if (!type || !category || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: "type, category, and amount are required" },
        { status: 400 }
      );
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const transaction = await Transaction.create({
      type,
      category,
      amount: parsedAmount,
      note,
      date: date ? new Date(date) : new Date(),
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("POST /api/transactions error", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}

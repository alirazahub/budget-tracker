import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import Group from "@/models/Group";
import Expense from "@/models/Expense";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;

  if (!Types.ObjectId.isValid(groupId)) {
    return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const expenses = await Expense.find({ groupId })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error(`GET /api/groups/${groupId}/expenses error`, error);
    return NextResponse.json({ error: "Failed to load expenses" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;

  if (!Types.ObjectId.isValid(groupId)) {
    return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { description, amount, type, paidBy, paidByUserId, involved, date, note } = body;

    if (!description || amount === undefined || !type || !paidBy || !paidByUserId) {
      return NextResponse.json(
        { error: "description, amount, type, paidBy, and paidByUserId are required" },
        { status: 400 }
      );
    }

    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const group = await Group.findById(groupId);
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const typeAllowed = group.expenseTypes.some(
      (entry) => entry.toLowerCase() === String(type).trim().toLowerCase()
    );

    if (!typeAllowed) {
      return NextResponse.json(
        { error: "Expense type is not allowed for this group" },
        { status: 400 }
      );
    }

    const memberNames = group.members.map((m) => m.name.toLowerCase());
    if (!memberNames.includes(String(paidBy).toLowerCase())) {
      return NextResponse.json({ error: "Paid by must be a group member" }, { status: 400 });
    }

    const involvedUsers: Array<{ userId: string; name: string }> = Array.isArray(involved)
      ? involved.map((item: { userId: string; name: string }) => ({
          userId: String(item.userId),
          name: String(item.name),
        }))
      : [];

    const allValidInvolved = involvedUsers.every((user) =>
      group.members.some((m) => m.name.toLowerCase() === user.name.toLowerCase())
    );

    if (!allValidInvolved) {
      return NextResponse.json({ error: "All involved users must be group members" }, { status: 400 });
    }

    const expense = await Expense.create({
      groupId,
      description,
      amount: numericAmount,
      type,
      paidBy,
      paidByUserId,
      involved: involvedUsers,
      date: date ? new Date(date) : new Date(),
      note,
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    console.error(`POST /api/groups/${groupId}/expenses error`, error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}

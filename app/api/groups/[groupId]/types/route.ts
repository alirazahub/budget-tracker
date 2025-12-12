import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import Group from "@/models/Group";

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
    const { type, actorName } = body;

    if (!type || !actorName) {
      return NextResponse.json(
        { error: "type and actorName are required" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const group = await Group.findById(groupId);

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const isAdmin = group.createdByName.toLowerCase() === actorName.toLowerCase();
    if (!isAdmin) {
      return NextResponse.json({ error: "Only group admin can add types" }, { status: 403 });
    }

    const exists = group.expenseTypes.some(
      (entry) => entry.toLowerCase() === String(type).trim().toLowerCase()
    );

    if (!exists) {
      group.expenseTypes.push(String(type).trim());
      await group.save();
    }

    return NextResponse.json({ group });
  } catch (error) {
    console.error(`POST /api/groups/${groupId}/types error`, error);
    return NextResponse.json({ error: "Failed to add expense type" }, { status: 500 });
  }
}

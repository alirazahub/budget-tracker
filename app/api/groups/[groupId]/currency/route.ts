import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import Group from "@/models/Group";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;

  if (!Types.ObjectId.isValid(groupId)) {
    return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { currency, userId } = body;

    if (!currency || typeof currency !== "string") {
      return NextResponse.json(
        { error: "currency field is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate userId for permission check
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: userId required" },
        { status: 401 }
      );
    }

    // Validate currency code (ISO 4217)
    const validCurrencies = [
      "USD", "EUR","GBP", "PKR"];

    if (!validCurrencies.includes(currency.toUpperCase())) {
      return NextResponse.json(
        { error: "Invalid currency code" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Verify user is group admin
    const group = await Group.findById(groupId);
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (group.createdById !== userId) {
      return NextResponse.json(
        { error: "Forbidden: Only group admin can change currency" },
        { status: 403 }
      );
    }

    // Update currency
    const updatedGroup = await Group.findByIdAndUpdate(
      groupId,
      { currency: currency.toUpperCase() },
      { new: true }
    );

    return NextResponse.json({ group: updatedGroup });
  } catch (error) {
    console.error(`PATCH /api/groups/${groupId}/currency error`, error);
    return NextResponse.json(
      { error: "Failed to update currency" },
      { status: 500 }
    );
  }
}

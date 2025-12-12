import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Group from "@/models/Group";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { inviteCode, memberName } = body;

    if (!inviteCode || !memberName) {
      return NextResponse.json(
        { error: "inviteCode and memberName are required" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const group = await Group.findOne({ inviteCode: inviteCode.trim() });

    if (!group) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    const exists = group.members.some(
      (member) => member.name.toLowerCase() === memberName.toLowerCase()
    );

    if (!exists) {
      // Mongoose will auto-generate _id for subdocument
      group.members.push({ name: memberName, role: "member" } as any);
      await group.save();
    }

    return NextResponse.json({ group });
  } catch (error) {
    console.error("POST /api/groups/join error", error);
    return NextResponse.json({ error: "Failed to join group" }, { status: 500 });
  }
}

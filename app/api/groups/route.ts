import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import Group from "@/models/Group";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberName = searchParams.get("memberName");

    await connectToDatabase();
    const query = memberName ? { "members.name": memberName } : {};

    const groups = await Group.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ groups });
  } catch (error) {
    console.error("GET /api/groups error", error);
    return NextResponse.json({ error: "Failed to load groups" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, createdByName, createdById } = body;

    if (!name || !createdByName || !createdById) {
      return NextResponse.json(
        { error: "name, createdByName, and createdById are required" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const group = await Group.create({ name, createdByName, createdById });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    console.error("POST /api/groups error", error);
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}

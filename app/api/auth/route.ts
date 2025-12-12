import { SignJWT } from "jose";
import bcryptjs from "bcryptjs";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import User from "@/models/User";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-key-change-in-prod");

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, action } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    if (action === "signup") {
      if (!name || name.trim().length === 0) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 400 }
        );
      }

      const hashedPassword = await bcryptjs.hash(password, 10);
      const user = await User.create({
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name.trim(),
      });

      const token = await new SignJWT({ userId: user._id.toString(), email: user.email })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("7d")
        .sign(secret);

      return NextResponse.json(
        { token, user: { id: user._id, email: user.email, name: user.name } },
        { status: 201 }
      );
    }

    if (action === "login") {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }

      const passwordMatch = await bcryptjs.compare(password, user.password);
      if (!passwordMatch) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }

      const token = await new SignJWT({ userId: user._id.toString(), email: user.email })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("7d")
        .sign(secret);

      return NextResponse.json({
        token,
        user: { id: user._id, email: user.email, name: user.name },
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/auth error", error);
    return NextResponse.json({ error: "Auth failed" }, { status: 500 });
  }
}

import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-key-change-in-prod");

export async function verifyAuth(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const verified = await jwtVerify(token, secret);
    return verified.payload as { userId: string; email: string };
  } catch {
    return null;
  }
}

import { sign, verify } from "hono/jwt";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}
const secret: string = process.env.JWT_SECRET;
const TTL_SECONDS = 7 * 24 * 60 * 60;

export function issueToken(userId: number): Promise<string> {
  return sign({ sub: userId, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS }, secret, "HS256");
}

export async function verifyToken(token: string): Promise<number | null> {
  try {
    const payload = await verify(token, secret, "HS256");
    return typeof payload.sub === "number" ? payload.sub : null;
  } catch {
    return null;
  }
}

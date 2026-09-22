import type { Context, Next } from "hono";
import { verifyToken } from "../lib/jwt.js";

async function authenticate(header: string | undefined): Promise<number | null> {
  const token = header?.match(/^Token (.+)$/)?.[1];
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(c: Context, next: Next) {
  const userId = await authenticate(c.req.header("Authorization"));
  if (userId === null) {
    return c.json({ errors: { token: ["is missing"] } }, 401);
  }
  c.set("userId", userId);
  await next();
}

export async function optionalAuth(c: Context, next: Next) {
  const userId = await authenticate(c.req.header("Authorization"));
  if (userId !== null) c.set("userId", userId);
  await next();
}

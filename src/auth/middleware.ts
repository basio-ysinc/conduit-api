import { createMiddleware } from "hono/factory";
import type { AppEnv, OptionalAuthEnv } from "../app.js";
import { findUserById } from "../services/users.js";
import { verifyToken } from "./jwt.js";

/**
 * `Authorization: Token <jwt>` を検証し、ユーザーを c.var.user に載せる。
 * ヘッダが無い/Token 形式でない → 401 errors.token "is missing"
 * トークン不正・期限切れ・ユーザー不存在 → 401 errors.token "is invalid"
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Token ") ? header.slice("Token ".length) : undefined;
  if (!token) return c.json({ errors: { token: ["is missing"] } }, 401);
  const userId = await verifyToken(token);
  const user = userId === null ? undefined : findUserById(c.get("db"), userId);
  if (!user) return c.json({ errors: { token: ["is invalid"] } }, 401);
  c.set("user", user);
  await next();
});

/**
 * 任意認証版。ヘッダが無ければ匿名のまま通し、有効なトークンがあれば c.var.user に載せる。
 * Token 形式でない/不正・期限切れ・ユーザー不存在のトークンが送られた場合のみ 401。
 */
export const optionalAuth = createMiddleware<OptionalAuthEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Token ") ? header.slice("Token ".length) : undefined;
  if (!token) return next();
  const userId = await verifyToken(token);
  const user = userId === null ? undefined : findUserById(c.get("db"), userId);
  if (!user) return c.json({ errors: { token: ["is invalid"] } }, 401);
  c.set("user", user);
  await next();
});

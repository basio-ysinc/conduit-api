import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import { issueToken } from "../auth/jwt.js";
import { validationErrors } from "../errors.js";
import { ConflictError, authenticateUser, createUser, userResponse } from "../services/users.js";

// パスワード方針: NIST 800-63B(errors_auth.hurl 参照)。最低 8 文字、上限なし
const passwordSchema = z
  .string()
  .min(1, "can't be blank")
  .min(8, "is too short (minimum is 8 characters)");

const registerSchema = z.object({
  user: z.object({
    username: z.string().min(1, "can't be blank"),
    email: z.string().min(1, "can't be blank"),
    password: passwordSchema,
  }),
});

const loginSchema = z.object({
  user: z.object({
    email: z.string().min(1, "can't be blank"),
    password: z.string().min(1, "can't be blank"),
  }),
});

export const usersRoutes = new Hono<AppEnv>();

usersRoutes.post("/api/users", async (c) => {
  const parsed = registerSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(validationErrors(parsed.error), 422);
  try {
    const user = createUser(c.get("db"), parsed.data.user);
    return c.json({ user: userResponse(user, await issueToken(user.id)) }, 201);
  } catch (e) {
    if (e instanceof ConflictError) {
      return c.json({ errors: { [e.field]: ["has already been taken"] } }, 409);
    }
    throw e;
  }
});

usersRoutes.post("/api/users/login", async (c) => {
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(validationErrors(parsed.error), 422);
  const { email, password } = parsed.data.user;
  const user = authenticateUser(c.get("db"), email, password);
  if (!user) return c.json({ errors: { credentials: ["invalid"] } }, 401);
  return c.json({ user: userResponse(user, await issueToken(user.id)) });
});

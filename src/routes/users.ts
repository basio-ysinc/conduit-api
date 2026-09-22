import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import { hashPassword, signToken } from "../auth.js";
import { fail, failValidation, readJson } from "../errors.js";
import {
  createUser,
  findUserByEmail,
  findUserByUsername,
  toUserResponse,
} from "../services/users.js";

const nonBlank = z.string().refine((s) => s.trim().length > 0);

const registerSchema = z.object({
  user: z.object({ username: nonBlank, email: nonBlank, password: nonBlank }),
});

export const usersRoutes = new Hono<AppEnv>();

usersRoutes.post("/", async (c) => {
  const parsed = registerSchema.safeParse(await readJson(c));
  if (!parsed.success) return failValidation(c, parsed.error);
  const db = c.get("db");
  const { username, email, password } = parsed.data.user;
  if (findUserByUsername(db, username)) return fail(c, 409, "username", "has already been taken");
  if (findUserByEmail(db, email)) return fail(c, 409, "email", "has already been taken");
  const user = createUser(db, { username, email, passwordHash: hashPassword(password) });
  return c.json({ user: toUserResponse(user, signToken(user.id)) }, 201);
});

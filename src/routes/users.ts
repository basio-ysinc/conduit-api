import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { issueToken } from "../lib/jwt.js";
import { createUser } from "../services/users.js";

export const usersRoutes = new Hono<AppEnv>();

usersRoutes.post("/users", async (c) => {
  const body = await c.req.json().catch(() => undefined);
  const input = body?.user;
  const errors: Record<string, string[]> = {};
  for (const field of ["username", "email", "password"] as const) {
    if (typeof input?.[field] !== "string" || input[field] === "") {
      errors[field] = ["can't be blank"];
    }
  }
  if (Object.keys(errors).length > 0) return c.json({ errors }, 422);

  const result = createUser(c.get("db"), {
    username: input.username,
    email: input.email,
    password: input.password,
  });
  if (!result.ok) {
    return c.json({ errors: { [result.conflict]: ["has already been taken"] } }, 409);
  }
  const { user } = result;
  return c.json(
    {
      user: {
        email: user.email,
        token: await issueToken(user.id),
        username: user.username,
        bio: user.bio,
        image: user.image,
      },
    },
    201,
  );
});

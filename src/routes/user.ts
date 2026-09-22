import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import { issueToken } from "../auth/jwt.js";
import { requireAuth } from "../auth/middleware.js";
import { validationErrors } from "../errors.js";
import { ConflictError, updateUser, userResponse } from "../services/users.js";

// bio / image は null 許容。空文字は null に正規化する(auth.hurl)
const updateSchema = z.object({
  user: z.object({
    username: z.string().min(1, "can't be blank").optional(),
    email: z.string().min(1, "can't be blank").optional(),
    password: z
      .string()
      .min(1, "can't be blank")
      .min(8, "is too short (minimum is 8 characters)")
      .optional(),
    bio: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
  }),
});

export const userRoutes = new Hono<AppEnv>();
userRoutes.use("/api/user", requireAuth);

userRoutes.get("/api/user", async (c) => {
  const user = c.get("user");
  return c.json({ user: userResponse(user, await issueToken(user.id)) });
});

userRoutes.put("/api/user", async (c) => {
  const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(validationErrors(parsed.error), 422);
  const patch = parsed.data.user;
  try {
    const user = updateUser(c.get("db"), c.get("user").id, {
      ...patch,
      bio: patch.bio === "" ? null : patch.bio,
      image: patch.image === "" ? null : patch.image,
    });
    return c.json({ user: userResponse(user, await issueToken(user.id)) });
  } catch (e) {
    if (e instanceof ConflictError) {
      return c.json({ errors: { [e.field]: ["has already been taken"] } }, 409);
    }
    throw e;
  }
});

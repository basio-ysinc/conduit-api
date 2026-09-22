import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { optionalAuth, requireAuth } from "../auth/middleware.js";
import {
  findUserByUsername,
  followUser,
  isFollowing,
  profileResponse,
  unfollowUser,
} from "../services/profiles.js";
import type { UserRow } from "../services/users.js";

export const profilesRoutes = new Hono<AppEnv>();

profilesRoutes.get("/api/profiles/:username", optionalAuth, (c) => {
  const db = c.get("db");
  const target = findUserByUsername(db, c.req.param("username"));
  if (!target) return c.json({ errors: { profile: ["not found"] } }, 404);
  const viewer: UserRow | undefined = c.get("user");
  const following = viewer !== undefined && isFollowing(db, viewer.id, target.id);
  return c.json({ profile: profileResponse(target, following) });
});

profilesRoutes.use("/api/profiles/:username/follow", requireAuth);

profilesRoutes.post("/api/profiles/:username/follow", (c) => {
  const db = c.get("db");
  const target = findUserByUsername(db, c.req.param("username"));
  if (!target) return c.json({ errors: { profile: ["not found"] } }, 404);
  const viewer = c.get("user");
  if (target.id === viewer.id) {
    return c.json({ errors: { profile: ["cannot follow yourself"] } }, 422);
  }
  followUser(db, viewer.id, target.id);
  return c.json({ profile: profileResponse(target, isFollowing(db, viewer.id, target.id)) });
});

profilesRoutes.delete("/api/profiles/:username/follow", (c) => {
  const db = c.get("db");
  const target = findUserByUsername(db, c.req.param("username"));
  if (!target) return c.json({ errors: { profile: ["not found"] } }, 404);
  const viewer = c.get("user");
  if (target.id === viewer.id) {
    return c.json({ errors: { profile: ["cannot follow yourself"] } }, 422);
  }
  unfollowUser(db, viewer.id, target.id);
  return c.json({ profile: profileResponse(target, isFollowing(db, viewer.id, target.id)) });
});

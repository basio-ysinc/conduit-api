import { Hono } from "hono";
import type { AppEnv, OptionalAuthEnv } from "../app.js";
import { optionalAuth, requireAuth } from "../auth/middleware.js";
import {
  findUserByUsername,
  followUser,
  isFollowing,
  profileResponse,
  unfollowUser,
} from "../services/profiles.js";

export const profilesRoutes = new Hono<OptionalAuthEnv>();

profilesRoutes.get("/api/profiles/:username", optionalAuth, (c) => {
  const db = c.get("db");
  const target = findUserByUsername(db, c.req.param("username"));
  if (!target) return c.json({ errors: { profile: ["not found"] } }, 404);
  const viewer = c.get("user");
  const following = viewer !== undefined && isFollowing(db, viewer.id, target.id);
  return c.json({ profile: profileResponse(target, following) });
});

export const profileFollowRoutes = new Hono<AppEnv>();

profileFollowRoutes.use("/api/profiles/:username/follow", requireAuth);

profileFollowRoutes.post("/api/profiles/:username/follow", (c) => {
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

profileFollowRoutes.delete("/api/profiles/:username/follow", (c) => {
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

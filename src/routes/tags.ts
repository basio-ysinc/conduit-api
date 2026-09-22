import { Hono } from "hono";
import type { OptionalAuthEnv } from "../app.js";
import { listTags } from "../services/tags.js";

export const tagsRoutes = new Hono<OptionalAuthEnv>();

// 認証不要(openapi.yml GetTags)
tagsRoutes.get("/api/tags", (c) => {
  return c.json({ tags: listTags(c.get("db")) });
});

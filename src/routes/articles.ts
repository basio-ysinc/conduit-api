import { Hono } from "hono";
import type { AppEnv } from "../app.js";
import { parsePagination } from "../lib/pagination.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { createArticle, deleteArticle, listArticles } from "../services/articles.js";

export const articlesRoutes = new Hono<AppEnv>();

articlesRoutes.get("/articles", optionalAuth, (c) => {
  const parsed = parsePagination({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.ok) return c.json({ errors: parsed.errors }, 422);
  const { articles, articlesCount } = listArticles(
    c.get("db"),
    {
      tag: c.req.query("tag"),
      author: c.req.query("author"),
      favorited: c.req.query("favorited"),
    },
    parsed.value,
    c.get("userId"),
  );
  return c.json({ articles, articlesCount });
});

articlesRoutes.post("/articles", requireAuth, async (c) => {
  const body = await c.req.json().catch(() => undefined);
  const input = body?.article;
  const errors: Record<string, string[]> = {};
  for (const field of ["title", "description", "body"] as const) {
    if (typeof input?.[field] !== "string" || input[field] === "") {
      errors[field] = ["can't be blank"];
    }
  }
  if (
    input?.tagList !== undefined &&
    (!Array.isArray(input.tagList) || input.tagList.some((t: unknown) => typeof t !== "string"))
  ) {
    errors.tagList = ["must be a list of strings"];
  }
  if (Object.keys(errors).length > 0) return c.json({ errors }, 422);

  const article = createArticle(c.get("db"), c.get("userId") as number, {
    title: input.title,
    description: input.description,
    body: input.body,
    tagList: input.tagList,
  });
  return c.json({ article }, 201);
});

articlesRoutes.delete("/articles/:slug", requireAuth, (c) => {
  const result = deleteArticle(
    c.get("db"),
    c.req.param("slug") as string,
    c.get("userId") as number,
  );
  if (result === "not_found") {
    return c.json({ errors: { article: ["not found"] } }, 404);
  }
  if (result === "forbidden") {
    return c.json({ errors: { article: ["forbidden"] } }, 403);
  }
  return c.body(null, 204);
});

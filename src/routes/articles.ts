import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import { requireAuth } from "../auth/middleware.js";
import { validationErrors } from "../errors.js";
import {
  articleResponse,
  createArticle,
  deleteArticle,
  findArticleBySlug,
  listArticles,
  updateArticle,
} from "../services/articles.js";
import { type UserRow, findUserById } from "../services/users.js";

const createSchema = z.object({
  article: z.object({
    title: z.string().min(1, "can't be blank"),
    description: z.string().min(1, "can't be blank"),
    body: z.string().min(1, "can't be blank"),
    tagList: z.array(z.string()).optional(),
  }),
});

const updateSchema = z.object({
  article: z.object({
    title: z.string().min(1, "can't be blank").optional(),
    description: z.string().min(1, "can't be blank").optional(),
    body: z.string().min(1, "can't be blank").optional(),
    tagList: z.array(z.string()).optional(),
  }),
});

// decisions.md TBD-2: limit 既定 20・上限 100、offset 既定 0。範囲外・非整数は 422
const listQuerySchema = z.object({
  tag: z.string().optional(),
  author: z.string().optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0)).optional(),
});

export const articlesRoutes = new Hono<AppEnv>();

articlesRoutes.post("/api/articles", requireAuth, async (c) => {
  const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(validationErrors(parsed.error), 422);
  const db = c.get("db");
  const user = c.get("user");
  const row = createArticle(db, user.id, parsed.data.article);
  return c.json({ article: articleResponse(db, row, user, { includeBody: true }) }, 201);
});

articlesRoutes.get("/api/articles", (c) => {
  const parsed = listQuerySchema.safeParse({
    tag: c.req.query("tag"),
    author: c.req.query("author"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json(validationErrors(parsed.error), 422);
  const db = c.get("db");
  const { rows, count } = listArticles(db, {
    ...parsed.data,
    limit: parsed.data.limit ?? 20,
    offset: parsed.data.offset ?? 0,
  });
  return c.json({
    articles: rows.map((row) =>
      articleResponse(db, row, findUserById(db, row.author_id) as UserRow, {
        includeBody: false,
      }),
    ),
    articlesCount: count,
  });
});

articlesRoutes.get("/api/articles/:slug", (c) => {
  const db = c.get("db");
  const row = findArticleBySlug(db, c.req.param("slug"));
  if (!row) return c.json({ errors: { article: ["not found"] } }, 404);
  return c.json({
    article: articleResponse(db, row, findUserById(db, row.author_id) as UserRow, {
      includeBody: true,
    }),
  });
});

articlesRoutes.put("/api/articles/:slug", requireAuth, async (c) => {
  const db = c.get("db");
  const row = findArticleBySlug(db, c.req.param("slug"));
  if (!row) return c.json({ errors: { article: ["not found"] } }, 404);
  const user = c.get("user");
  if (row.author_id !== user.id) {
    return c.json({ errors: { article: ["forbidden"] } }, 403);
  }
  const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(validationErrors(parsed.error), 422);
  const updated = updateArticle(db, row, parsed.data.article);
  return c.json({ article: articleResponse(db, updated, user, { includeBody: true }) });
});

articlesRoutes.delete("/api/articles/:slug", requireAuth, (c) => {
  const db = c.get("db");
  const row = findArticleBySlug(db, c.req.param("slug"));
  if (!row) return c.json({ errors: { article: ["not found"] } }, 404);
  if (row.author_id !== c.get("user").id) {
    return c.json({ errors: { article: ["forbidden"] } }, 403);
  }
  deleteArticle(db, row.id);
  return c.body(null, 204);
});

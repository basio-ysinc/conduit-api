import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import { authErrorMessage, authenticate } from "../auth.js";
import { fail, failValidation, readJson } from "../errors.js";
import {
  createArticle,
  deleteArticle,
  getArticleBySlug,
  toArticleResponse,
  updateArticle,
} from "../services/articles.js";

const nonBlank = z.string().refine((s) => s.trim().length > 0);

const createSchema = z.object({
  article: z.object({
    title: nonBlank,
    description: nonBlank,
    body: nonBlank,
    tagList: z.array(z.string()).optional(),
  }),
});

const updateSchema = z.object({
  article: z.object({
    title: nonBlank.optional(),
    description: nonBlank.optional(),
    body: nonBlank.optional(),
    tagList: z.array(z.string()).optional(),
  }),
});

export const articlesRoutes = new Hono<AppEnv>();

articlesRoutes.post("/", async (c) => {
  const db = c.get("db");
  const auth = authenticate(db, c.req.header("Authorization"));
  if ("error" in auth) return fail(c, 401, "token", authErrorMessage(auth.error));
  const parsed = createSchema.safeParse(await readJson(c));
  if (!parsed.success) return failValidation(c, parsed.error);
  const article = createArticle(db, auth.user.id, parsed.data.article);
  return c.json({ article: toArticleResponse(db, article) }, 201);
});

articlesRoutes.get("/:slug", (c) => {
  const db = c.get("db");
  const article = getArticleBySlug(db, c.req.param("slug"));
  if (!article) return fail(c, 404, "article", "not found");
  return c.json({ article: toArticleResponse(db, article) });
});

articlesRoutes.put("/:slug", async (c) => {
  const db = c.get("db");
  const auth = authenticate(db, c.req.header("Authorization"));
  if ("error" in auth) return fail(c, 401, "token", authErrorMessage(auth.error));
  const article = getArticleBySlug(db, c.req.param("slug"));
  if (!article) return fail(c, 404, "article", "not found");
  if (article.author_id !== auth.user.id) return fail(c, 403, "article", "forbidden");
  const parsed = updateSchema.safeParse(await readJson(c));
  if (!parsed.success) return failValidation(c, parsed.error);
  const updated = updateArticle(db, article, parsed.data.article);
  return c.json({ article: toArticleResponse(db, updated) });
});

articlesRoutes.delete("/:slug", (c) => {
  const db = c.get("db");
  const auth = authenticate(db, c.req.header("Authorization"));
  if ("error" in auth) return fail(c, 401, "token", authErrorMessage(auth.error));
  const article = getArticleBySlug(db, c.req.param("slug"));
  if (!article) return fail(c, 404, "article", "not found");
  if (article.author_id !== auth.user.id) return fail(c, 403, "article", "forbidden");
  deleteArticle(db, article);
  return c.body(null, 204);
});

import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv, OptionalAuthEnv } from "../app.js";
import { optionalAuth, requireAuth } from "../auth/middleware.js";
import { validationErrors } from "../errors.js";
import { findArticleBySlug } from "../services/articles.js";
import {
  addComment,
  commentResponse,
  deleteComment,
  findCommentById,
  listComments,
} from "../services/comments.js";
import { type UserRow, findUserById } from "../services/users.js";

const createSchema = z.object({
  comment: z.object({
    body: z.string().refine((s) => s.trim().length > 0, "can't be blank"),
  }),
});

// decisions.md TBD-2: limit 既定 20・上限 100、offset 既定 0。範囲外・非整数は 422
const listQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional(),
  offset: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER))
    .optional(),
});

/** 認証任意の読み取り系。c.var.user は undefined になりうる(OptionalAuthEnv)。 */
export const commentsRoutes = new Hono<OptionalAuthEnv>();

commentsRoutes.get("/api/articles/:slug/comments", optionalAuth, (c) => {
  const db = c.get("db");
  const article = findArticleBySlug(db, c.req.param("slug"));
  if (!article) return c.json({ errors: { article: ["not found"] } }, 404);
  const parsed = listQuerySchema.safeParse({
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  if (!parsed.success) return c.json(validationErrors(parsed.error), 422);
  const viewer = c.get("user");
  const comments = listComments(
    db,
    article.id,
    parsed.data.limit ?? 20,
    parsed.data.offset ?? 0,
  ).map((row) => commentResponse(db, row, findUserById(db, row.author_id) as UserRow, viewer));
  return c.json({ comments });
});

/** 認証必須の系。 */
export const commentProtectedRoutes = new Hono<AppEnv>();

commentProtectedRoutes.post("/api/articles/:slug/comments", requireAuth, async (c) => {
  const db = c.get("db");
  const article = findArticleBySlug(db, c.req.param("slug"));
  if (!article) return c.json({ errors: { article: ["not found"] } }, 404);
  const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(validationErrors(parsed.error), 422);
  const user = c.get("user");
  const row = addComment(db, article.id, user.id, parsed.data.comment.body);
  return c.json({ comment: commentResponse(db, row, user, user) }, 201);
});

commentProtectedRoutes.delete("/api/articles/:slug/comments/:id", requireAuth, (c) => {
  const db = c.get("db");
  const article = findArticleBySlug(db, c.req.param("slug"));
  if (!article) return c.json({ errors: { article: ["not found"] } }, 404);
  const id = Number(c.req.param("id"));
  const comment = Number.isInteger(id) ? findCommentById(db, id) : undefined;
  if (!comment || comment.article_id !== article.id) {
    return c.json({ errors: { comment: ["not found"] } }, 404);
  }
  if (comment.author_id !== c.get("user").id) {
    return c.json({ errors: { comment: ["forbidden"] } }, 403);
  }
  deleteComment(db, comment.id);
  return c.body(null, 204);
});

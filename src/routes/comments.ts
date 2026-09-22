import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import { authErrorMessage, authenticate } from "../auth.js";
import { fail, failValidation, readJson } from "../errors.js";
import { getArticleBySlug } from "../services/articles.js";
import {
  addComment,
  deleteComment,
  findCommentById,
  listComments,
  toCommentResponse,
} from "../services/comments.js";

const createSchema = z.object({
  comment: z.object({ body: z.string().refine((s) => s.trim().length > 0) }),
});

export const commentsRoutes = new Hono<AppEnv>();

// 認証は任意。記事が無ければ 404。
commentsRoutes.get("/:slug/comments", (c) => {
  const db = c.get("db");
  const article = getArticleBySlug(db, c.req.param("slug"));
  if (!article) return fail(c, 404, "article", "not found");
  const comments = listComments(db, article.id).map((row) => toCommentResponse(row));
  return c.json({ comments });
});

commentsRoutes.post("/:slug/comments", async (c) => {
  const db = c.get("db");
  const auth = authenticate(db, c.req.header("Authorization"));
  if ("error" in auth) return fail(c, 401, "token", authErrorMessage(auth.error));
  const article = getArticleBySlug(db, c.req.param("slug"));
  if (!article) return fail(c, 404, "article", "not found");
  const parsed = createSchema.safeParse(await readJson(c));
  if (!parsed.success) return failValidation(c, parsed.error);
  const comment = addComment(db, article.id, auth.user.id, parsed.data.comment.body);
  return c.json({ comment: toCommentResponse(comment, auth.user) }, 201);
});

commentsRoutes.delete("/:slug/comments/:id", (c) => {
  const db = c.get("db");
  const auth = authenticate(db, c.req.header("Authorization"));
  if ("error" in auth) return fail(c, 401, "token", authErrorMessage(auth.error));
  const article = getArticleBySlug(db, c.req.param("slug"));
  if (!article) return fail(c, 404, "article", "not found");
  const id = Number(c.req.param("id"));
  const comment = Number.isInteger(id) ? findCommentById(db, id) : null;
  if (!comment || comment.article_id !== article.id) return fail(c, 404, "comment", "not found");
  if (comment.author_id !== auth.user.id) return fail(c, 403, "comment", "forbidden");
  deleteComment(db, comment);
  return c.body(null, 204);
});

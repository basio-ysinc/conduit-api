import type { Db } from "../db/index.js";
import { type UserRow, toProfile } from "./users.js";

export type CommentRow = {
  id: number;
  article_id: number;
  author_id: number;
  body: string;
  created_at: string;
  updated_at: string;
};

type CommentWithAuthor = CommentRow & {
  author_username: string;
  author_bio: string | null;
  author_image: string | null;
};

export function addComment(db: Db, articleId: number, authorId: number, body: string): CommentRow {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      "INSERT INTO comments (article_id, author_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(articleId, authorId, body, now, now);
  return findCommentById(db, Number(info.lastInsertRowid)) as CommentRow;
}

export function findCommentById(db: Db, id: number): CommentRow | null {
  return (db.prepare("SELECT * FROM comments WHERE id = ?").get(id) as CommentRow) ?? null;
}

/** 記事に紐づくコメントを作者情報つきで返す(作成順)。 */
export function listComments(
  db: Db,
  articleId: number,
  limit: number,
  offset: number,
): CommentWithAuthor[] {
  return db
    .prepare(
      `SELECT c.*, u.username AS author_username, u.bio AS author_bio, u.image AS author_image
       FROM comments c JOIN users u ON u.id = c.author_id
       WHERE c.article_id = ? ORDER BY c.id LIMIT ? OFFSET ?`,
    )
    .all(articleId, limit, offset) as CommentWithAuthor[];
}

export function deleteComment(db: Db, comment: CommentRow): void {
  db.prepare("DELETE FROM comments WHERE id = ?").run(comment.id);
}

export function toCommentResponse(comment: CommentRow | CommentWithAuthor, author?: UserRow) {
  const profile =
    "author_username" in comment
      ? {
          username: comment.author_username,
          bio: comment.author_bio,
          image: comment.author_image,
          following: false,
        }
      : toProfile(author as UserRow);
  return {
    id: comment.id,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    body: comment.body,
    author: profile,
  };
}

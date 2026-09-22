import type { Db } from "../db/index.js";
import { isFollowing, profileResponse } from "./profiles.js";
import type { UserRow } from "./users.js";

export type CommentRow = {
  id: number;
  article_id: number;
  author_id: number;
  body: string;
  created_at: string;
  updated_at: string;
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

export function findCommentById(db: Db, id: number): CommentRow | undefined {
  return db.prepare("SELECT * FROM comments WHERE id = ?").get(id) as CommentRow | undefined;
}

/** 記事に紐づくコメントを作成順で返す。 */
export function listComments(
  db: Db,
  articleId: number,
  limit: number,
  offset: number,
): CommentRow[] {
  return db
    .prepare("SELECT * FROM comments WHERE article_id = ? ORDER BY id LIMIT ? OFFSET ?")
    .all(articleId, limit, offset) as CommentRow[];
}

export function deleteComment(db: Db, id: number): void {
  db.prepare("DELETE FROM comments WHERE id = ?").run(id);
}

/** コメントの JSON 表現。author.following は viewer(閲覧ユーザー)基準、未認証なら false。 */
export function commentResponse(db: Db, row: CommentRow, author: UserRow, viewer?: UserRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    body: row.body,
    author: profileResponse(author, viewer !== undefined && isFollowing(db, viewer.id, author.id)),
  };
}

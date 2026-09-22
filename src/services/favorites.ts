import type { Db } from "../db/index.js";

/** 冪等: 既にお気に入り済みでも成功扱いにする。 */
export function favoriteArticle(db: Db, userId: number, articleId: number): void {
  db.prepare("INSERT OR IGNORE INTO favorites (user_id, article_id) VALUES (?, ?)").run(
    userId,
    articleId,
  );
}

/** 冪等: お気に入りしていなくても成功扱いにする。 */
export function unfavoriteArticle(db: Db, userId: number, articleId: number): void {
  db.prepare("DELETE FROM favorites WHERE user_id = ? AND article_id = ?").run(userId, articleId);
}

export function isFavorited(db: Db, userId: number, articleId: number): boolean {
  return (
    db
      .prepare("SELECT 1 FROM favorites WHERE user_id = ? AND article_id = ?")
      .get(userId, articleId) !== undefined
  );
}

export function favoritesCount(db: Db, articleId: number): number {
  return (
    db.prepare("SELECT COUNT(*) AS c FROM favorites WHERE article_id = ?").get(articleId) as {
      c: number;
    }
  ).c;
}

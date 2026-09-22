import type { Db } from "../db/index.js";

/**
 * 記事に使われているタグ名の一覧を返す(重複なし)。
 * 並び順は使用数の降順、同数は名前の昇順。
 */
export function listTags(db: Db): string[] {
  const rows = db
    .prepare(
      `SELECT t.name
       FROM article_tags at JOIN tags t ON t.id = at.tag_id
       GROUP BY at.tag_id
       ORDER BY COUNT(*) DESC, t.name ASC`,
    )
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}

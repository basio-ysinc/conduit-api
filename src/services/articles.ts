import { randomBytes } from "node:crypto";
import type { Db } from "../db/index.js";
import { favoritesCount, isFavorited } from "./favorites.js";
import type { UserRow } from "./users.js";

export type ArticleRow = {
  id: number;
  slug: string;
  title: string;
  description: string;
  body: string;
  author_id: number;
  created_at: string;
  updated_at: string;
};

// decisions.md TBD-1: タイトルを kebab-case 化し、空白・句読点・記号の連続は 1 個の `-` にする。
// 非 ASCII の文字(日本語等)は残す(Unicode slug)。
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

// TBD-1: 衝突時は `-` + 短いランダム接尾辞。変換結果が空なら接尾辞のみを slug にする。
function uniqueSlug(db: Db, title: string): string {
  const exists = db.prepare("SELECT 1 FROM articles WHERE slug = ?");
  const suffix = () => randomBytes(3).toString("hex");
  const base = slugify(title);
  let slug = base || suffix();
  while (exists.get(slug)) slug = base ? `${base}-${suffix()}` : suffix();
  return slug;
}

export function findArticleBySlug(db: Db, slug: string): ArticleRow | undefined {
  return db.prepare("SELECT * FROM articles WHERE slug = ?").get(slug) as ArticleRow | undefined;
}

export type CreateArticleInput = {
  title: string;
  description: string;
  body: string;
  tagList?: string[];
};

export function createArticle(db: Db, authorId: number, input: CreateArticleInput): ArticleRow {
  const now = new Date().toISOString();
  const slug = uniqueSlug(db, input.title);
  db.transaction(() => {
    const result = db
      .prepare(
        "INSERT INTO articles (slug, title, description, body, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(slug, input.title, input.description, input.body, authorId, now, now);
    if (input.tagList !== undefined) {
      replaceTags(db, Number(result.lastInsertRowid), input.tagList);
    }
  })();
  return findArticleBySlug(db, slug) as ArticleRow;
}

export type UpdateArticlePatch = {
  title?: string;
  description?: string;
  body?: string;
  tagList?: string[];
};

/** 指定されたフィールドだけ部分更新する。slug は更新しない(decisions.md TBD-1)。 */
export function updateArticle(db: Db, row: ArticleRow, patch: UpdateArticlePatch): ArticleRow {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const field of ["title", "description", "body"] as const) {
    if (patch[field] !== undefined) {
      sets.push(`${field} = ?`);
      values.push(patch[field]);
    }
  }
  db.transaction(() => {
    if (sets.length > 0 || patch.tagList !== undefined) {
      // 同一ミリ秒の連続更新でも updated_at が必ず進むようにする
      const next = Math.max(Date.now(), Date.parse(row.updated_at) + 1);
      sets.push("updated_at = ?");
      values.push(new Date(next).toISOString());
      db.prepare(`UPDATE articles SET ${sets.join(", ")} WHERE id = ?`).run(...values, row.id);
    }
    if (patch.tagList !== undefined) replaceTags(db, row.id, patch.tagList);
  })();
  return findArticleBySlug(db, row.slug) as ArticleRow;
}

export function deleteArticle(db: Db, id: number): void {
  db.prepare("DELETE FROM articles WHERE id = ?").run(id);
}

export type ListArticlesQuery = {
  tag?: string;
  author?: string;
  favorited?: string;
  limit: number;
  offset: number;
};

/** 作成日時の降順で返す。count は limit/offset 適用前の総件数(decisions.md TBD-2)。 */
export function listArticles(
  db: Db,
  query: ListArticlesQuery,
): { rows: ArticleRow[]; count: number } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (query.author !== undefined) {
    where.push("u.username = ?");
    params.push(query.author);
  }
  if (query.tag !== undefined) {
    where.push(
      "EXISTS (SELECT 1 FROM article_tags at JOIN tags t ON t.id = at.tag_id WHERE at.article_id = a.id AND t.name = ?)",
    );
    params.push(query.tag);
  }
  if (query.favorited !== undefined) {
    where.push(
      "EXISTS (SELECT 1 FROM favorites f JOIN users fu ON fu.id = f.user_id WHERE f.article_id = a.id AND fu.username = ?)",
    );
    params.push(query.favorited);
  }
  const cond = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const from = "FROM articles a JOIN users u ON u.id = a.author_id";
  const count = (db.prepare(`SELECT COUNT(*) AS c ${from} ${cond}`).get(...params) as { c: number })
    .c;
  const rows = db
    .prepare(`SELECT a.* ${from} ${cond} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`)
    .all(...params, query.limit, query.offset) as ArticleRow[];
  return { rows, count };
}

/** タグ名の配列で記事のタグを張り替える。記事内の並び順を position に保持する。 */
function replaceTags(db: Db, articleId: number, tagList: string[]): void {
  const names = [...new Set(tagList)];
  const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)");
  const findTag = db.prepare("SELECT id FROM tags WHERE name = ?");
  const insertLink = db.prepare(
    "INSERT INTO article_tags (article_id, tag_id, position) VALUES (?, ?, ?)",
  );
  db.prepare("DELETE FROM article_tags WHERE article_id = ?").run(articleId);
  names.forEach((name, position) => {
    insertTag.run(name);
    const tagId = (findTag.get(name) as { id: number }).id;
    insertLink.run(articleId, tagId, position);
  });
}

function tagNames(db: Db, articleId: number): string[] {
  const rows = db
    .prepare(
      "SELECT t.name FROM article_tags at JOIN tags t ON t.id = at.tag_id WHERE at.article_id = ? ORDER BY at.position",
    )
    .all(articleId) as { name: string }[];
  return rows.map((r) => r.name);
}

type Profile = { username: string; bio: string | null; image: string | null; following: boolean };

// follows 機能(A6 以降)が入るまで following は常に false
function profileResponse(author: UserRow): Profile {
  return {
    username: author.username,
    bio: author.bio,
    image: author.image,
    following: false,
  };
}

/**
 * 記事の JSON 表現。favorited は viewer(閲覧ユーザー)基準、未認証なら false。
 * 一覧では body を含めない(openapi.yml MultipleArticlesResponse)。
 */
export function articleResponse(
  db: Db,
  row: ArticleRow,
  author: UserRow,
  { includeBody, viewer }: { includeBody: boolean; viewer?: UserRow },
) {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    ...(includeBody ? { body: row.body } : {}),
    tagList: tagNames(db, row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    favorited: viewer !== undefined && isFavorited(db, viewer.id, row.id),
    favoritesCount: favoritesCount(db, row.id),
    author: profileResponse(author),
  };
}

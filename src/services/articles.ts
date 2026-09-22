import { randomBytes } from "node:crypto";
import type { Db } from "../db/index.js";
import { type Profile, findUserById, toProfile } from "./users.js";

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

export type ArticleInput = {
  title: string;
  description: string;
  body: string;
  tagList?: string[];
};

export type ArticlePatch = Partial<ArticleInput>;

/** タイトルを kebab-case にする。非 ASCII は残し、空白・句読点・記号の連続は 1 個の - に畳む。 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

const suffix = () => randomBytes(3).toString("hex");

function uniqueSlug(db: Db, title: string): string {
  const base = slugify(title);
  const exists = db.prepare("SELECT 1 FROM articles WHERE slug = ?");
  let slug = base === "" ? suffix() : base;
  while (exists.get(slug)) {
    slug = base === "" ? suffix() : `${base}-${suffix()}`;
  }
  return slug;
}

function setTags(db: Db, articleId: number, tags: string[]) {
  db.prepare("DELETE FROM article_tags WHERE article_id = ?").run(articleId);
  const insert = db.prepare(
    "INSERT INTO article_tags (article_id, tag, position) VALUES (?, ?, ?)",
  );
  [...new Set(tags)].forEach((tag, i) => insert.run(articleId, tag, i));
}

export function createArticle(db: Db, authorId: number, input: ArticleInput): ArticleRow {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      "INSERT INTO articles (slug, title, description, body, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      uniqueSlug(db, input.title),
      input.title,
      input.description,
      input.body,
      authorId,
      now,
      now,
    );
  const id = Number(info.lastInsertRowid);
  setTags(db, id, input.tagList ?? []);
  return getArticleById(db, id) as ArticleRow;
}

export function getArticleById(db: Db, id: number): ArticleRow | null {
  return (db.prepare("SELECT * FROM articles WHERE id = ?").get(id) as ArticleRow) ?? null;
}

export function getArticleBySlug(db: Db, slug: string): ArticleRow | null {
  return (db.prepare("SELECT * FROM articles WHERE slug = ?").get(slug) as ArticleRow) ?? null;
}

export function updateArticle(db: Db, article: ArticleRow, patch: ArticlePatch): ArticleRow {
  const title = patch.title ?? article.title;
  const description = patch.description ?? article.description;
  const body = patch.body ?? article.body;
  db.prepare(
    "UPDATE articles SET title = ?, description = ?, body = ?, updated_at = ? WHERE id = ?",
  ).run(title, description, body, new Date().toISOString(), article.id);
  if (patch.tagList !== undefined) setTags(db, article.id, patch.tagList);
  return getArticleById(db, article.id) as ArticleRow;
}

export function deleteArticle(db: Db, article: ArticleRow): void {
  db.prepare("DELETE FROM articles WHERE id = ?").run(article.id);
}

export function toArticleResponse(db: Db, article: ArticleRow) {
  const author = findUserById(db, article.author_id);
  const tagList = db
    .prepare("SELECT tag FROM article_tags WHERE article_id = ? ORDER BY position")
    .all(article.id)
    .map((r) => (r as { tag: string }).tag);
  return {
    slug: article.slug,
    title: article.title,
    description: article.description,
    body: article.body,
    tagList,
    createdAt: article.created_at,
    updatedAt: article.updated_at,
    favorited: false,
    favoritesCount: 0,
    author: author
      ? toProfile(author)
      : ({ username: "", bio: null, image: null, following: false } as Profile),
  };
}

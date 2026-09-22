import { randomBytes } from "node:crypto";
import type { Db } from "../db/index.js";

type ArticleRow = {
  id: number;
  slug: string;
  title: string;
  description: string;
  body: string;
  author_id: number;
  created_at: string;
  updated_at: string;
};

type ListRow = ArticleRow & {
  author_username: string;
  author_bio: string | null;
  author_image: string | null;
};

export type ArticleJson = {
  slug: string;
  title: string;
  description: string;
  body?: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: {
    username: string;
    bio: string | null;
    image: string | null;
    following: boolean;
  };
};

const randomSuffix = () => randomBytes(3).toString("hex");

// TBD-1: タイトルを kebab-case 化し、衝突時はランダム接尾辞で一意にする
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueSlug(db: Db, title: string): string {
  const base = slugify(title);
  const exists = db.prepare("SELECT 1 FROM articles WHERE slug = ?");
  let slug = base === "" ? randomSuffix() : base;
  while (exists.get(slug)) {
    slug = base === "" ? randomSuffix() : `${base}-${randomSuffix()}`;
  }
  return slug;
}

export function createArticle(
  db: Db,
  authorId: number,
  input: { title: string; description: string; body: string; tagList?: string[] },
): ArticleJson {
  const now = new Date().toISOString();
  const slug = uniqueSlug(db, input.title);
  const tags = [...new Set(input.tagList ?? [])];
  const insert = db.prepare(
    "INSERT INTO articles (slug, title, description, body, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertTag = db.prepare(
    "INSERT INTO article_tags (article_id, tag, position) VALUES (?, ?, ?)",
  );
  const articleId = db.transaction(() => {
    const { lastInsertRowid } = insert.run(
      slug,
      input.title,
      input.description,
      input.body,
      authorId,
      now,
      now,
    );
    const id = Number(lastInsertRowid);
    tags.forEach((tag, i) => insertTag.run(id, tag, i));
    return id;
  })();
  const row = getRow(db, articleId) as ArticleRow;
  const author = db
    .prepare("SELECT username, bio, image FROM users WHERE id = ?")
    .get(authorId) as { username: string; bio: string | null; image: string | null };
  return toJson(row, {
    author,
    tagList: tags,
    favorited: false,
    favoritesCount: 0,
    includeBody: true,
  });
}

function getRow(db: Db, id: number): ArticleRow | undefined {
  return db.prepare("SELECT * FROM articles WHERE id = ?").get(id) as ArticleRow | undefined;
}

export type ListFilter = {
  tag?: string;
  author?: string;
  favorited?: string;
};

function buildWhere(filter: ListFilter): { whereSql: string; params: string[] } {
  const where: string[] = [];
  const params: string[] = [];
  if (filter.tag !== undefined) {
    where.push("EXISTS (SELECT 1 FROM article_tags t WHERE t.article_id = a.id AND t.tag = ?)");
    params.push(filter.tag);
  }
  if (filter.author !== undefined) {
    where.push("u.username = ?");
    params.push(filter.author);
  }
  if (filter.favorited !== undefined) {
    where.push(
      "EXISTS (SELECT 1 FROM favorites f JOIN users fu ON fu.id = f.user_id WHERE f.article_id = a.id AND fu.username = ?)",
    );
    params.push(filter.favorited);
  }
  return { whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

/**
 * 一覧取得。articlesCount はフィルタ後・ページネーション前の総件数(TBD-2)。
 * feed(A5)も同じ組み立てで author_id の絞り込みだけ差し替える想定。
 */
export function listArticles(
  db: Db,
  filter: ListFilter,
  page: { limit: number; offset: number },
  viewerId: number | undefined,
): { articles: ArticleJson[]; articlesCount: number } {
  const { whereSql, params } = buildWhere(filter);
  const rows = db
    .prepare(
      `SELECT a.*, u.username AS author_username, u.bio AS author_bio, u.image AS author_image
       FROM articles a JOIN users u ON u.id = a.author_id
       ${whereSql}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, page.limit, page.offset) as ListRow[];
  const { n: articlesCount } = db
    .prepare(`SELECT COUNT(*) AS n FROM articles a JOIN users u ON u.id = a.author_id ${whereSql}`)
    .get(...params) as { n: number };
  return { articles: toJsonList(db, rows, viewerId), articlesCount };
}

function toJsonList(db: Db, rows: ListRow[], viewerId: number | undefined): ArticleJson[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");

  const tagRows = db
    .prepare(
      `SELECT article_id, tag FROM article_tags WHERE article_id IN (${placeholders}) ORDER BY position`,
    )
    .all(...ids) as { article_id: number; tag: string }[];
  const tagsByArticle = new Map<number, string[]>();
  for (const { article_id, tag } of tagRows) {
    const list = tagsByArticle.get(article_id) ?? [];
    list.push(tag);
    tagsByArticle.set(article_id, list);
  }

  const favRows = db
    .prepare(
      `SELECT article_id, COUNT(*) AS n FROM favorites WHERE article_id IN (${placeholders}) GROUP BY article_id`,
    )
    .all(...ids) as { article_id: number; n: number }[];
  const favCountByArticle = new Map(favRows.map((r) => [r.article_id, r.n]));

  const viewerFavs = new Set<number>(
    viewerId === undefined
      ? []
      : (
          db
            .prepare(
              `SELECT article_id FROM favorites WHERE user_id = ? AND article_id IN (${placeholders})`,
            )
            .all(viewerId, ...ids) as { article_id: number }[]
        ).map((r) => r.article_id),
  );

  return rows.map((row) =>
    toJson(row, {
      author: {
        username: row.author_username,
        bio: row.author_bio,
        image: row.author_image,
      },
      tagList: tagsByArticle.get(row.id) ?? [],
      favorited: viewerFavs.has(row.id),
      favoritesCount: favCountByArticle.get(row.id) ?? 0,
      includeBody: false,
    }),
  );
}

export type DeleteResult = "deleted" | "not_found" | "forbidden";

export function deleteArticle(db: Db, slug: string, userId: number): DeleteResult {
  const row = db.prepare("SELECT id, author_id FROM articles WHERE slug = ?").get(slug) as
    | { id: number; author_id: number }
    | undefined;
  if (!row) return "not_found";
  if (row.author_id !== userId) return "forbidden";
  db.prepare("DELETE FROM articles WHERE id = ?").run(row.id);
  return "deleted";
}

function toJson(
  row: ArticleRow,
  ctx: {
    author: { username: string; bio: string | null; image: string | null };
    tagList: string[];
    favorited: boolean;
    favoritesCount: number;
    includeBody: boolean;
  },
): ArticleJson {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    ...(ctx.includeBody ? { body: row.body } : {}),
    tagList: ctx.tagList,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    favorited: ctx.favorited,
    favoritesCount: ctx.favoritesCount,
    author: { ...ctx.author, following: false },
  };
}

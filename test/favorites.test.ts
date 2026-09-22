import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db/index.js";

function app() {
  return createApp(openDatabase(":memory:"));
}

async function register(
  a: ReturnType<typeof app>,
  user: Record<string, unknown> = {
    username: "jake",
    email: "jake@test.com",
    password: "password123",
  },
) {
  const res = await a.request("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user }),
  });
  return ((await res.json()).user.token as string) ?? "";
}

const newArticle = {
  title: "How to train your dragon",
  description: "Ever wonder how?",
  body: "It takes a Jacobian",
};

async function createArticle(a: ReturnType<typeof app>, token: string, article = newArticle) {
  const res = await a.request("/api/articles", {
    method: "POST",
    headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ article }),
  });
  return (await res.json()).article.slug as string;
}

function favorite(a: ReturnType<typeof app>, slug: string, token: string | null) {
  return a.request(`/api/articles/${slug}/favorite`, {
    method: "POST",
    headers: token ? { Authorization: `Token ${token}` } : {},
  });
}

function unfavorite(a: ReturnType<typeof app>, slug: string, token: string | null) {
  return a.request(`/api/articles/${slug}/favorite`, {
    method: "DELETE",
    headers: token ? { Authorization: `Token ${token}` } : {},
  });
}

describe("POST /api/articles/:slug/favorite", () => {
  it("お気に入り登録でき、favorited=true・favoritesCount=1 の記事を返す", async () => {
    const a = app();
    const token = await register(a);
    const slug = await createArticle(a, token);
    const res = await favorite(a, slug, token);
    expect(res.status).toBe(200);
    const { article } = await res.json();
    expect(article.slug).toBe(slug);
    expect(article.favorited).toBe(true);
    expect(article.favoritesCount).toBe(1);
    expect(article.author.username).toBe("jake");
  });

  it("冪等: 2回登録しても favoritesCount は 1 のまま", async () => {
    const a = app();
    const token = await register(a);
    const slug = await createArticle(a, token);
    await favorite(a, slug, token);
    const res = await favorite(a, slug, token);
    expect(res.status).toBe(200);
    const { article } = await res.json();
    expect(article.favorited).toBe(true);
    expect(article.favoritesCount).toBe(1);
  });

  it("未認証は 401、存在しない slug は 404 を返す", async () => {
    const a = app();
    const token = await register(a);
    const unauth = await favorite(a, "some-slug", null);
    expect(unauth.status).toBe(401);
    expect((await unauth.json()).errors.token[0]).toBe("is missing");
    const missing = await favorite(a, "no-such", token);
    expect(missing.status).toBe(404);
    expect((await missing.json()).errors.article[0]).toBe("not found");
  });
});

describe("DELETE /api/articles/:slug/favorite", () => {
  it("お気に入り解除でき、favorited=false・favoritesCount=0 の記事を返す", async () => {
    const a = app();
    const token = await register(a);
    const slug = await createArticle(a, token);
    await favorite(a, slug, token);
    const res = await unfavorite(a, slug, token);
    expect(res.status).toBe(200);
    const { article } = await res.json();
    expect(article.favorited).toBe(false);
    expect(article.favoritesCount).toBe(0);
  });

  it("冪等: お気に入りしていない記事の解除も 200 を返す", async () => {
    const a = app();
    const token = await register(a);
    const slug = await createArticle(a, token);
    const res = await unfavorite(a, slug, token);
    expect(res.status).toBe(200);
    const { article } = await res.json();
    expect(article.favorited).toBe(false);
    expect(article.favoritesCount).toBe(0);
  });

  it("未認証は 401、存在しない slug は 404 を返す", async () => {
    const a = app();
    const token = await register(a);
    const unauth = await unfavorite(a, "some-slug", null);
    expect(unauth.status).toBe(401);
    expect((await unauth.json()).errors.token[0]).toBe("is missing");
    const missing = await unfavorite(a, "no-such", token);
    expect(missing.status).toBe(404);
    expect((await missing.json()).errors.article[0]).toBe("not found");
  });
});

describe("favorited / favoritesCount の反映", () => {
  it("GET /api/articles/:slug は認証ユーザーの favorited を返し、匿名は false", async () => {
    const a = app();
    const token = await register(a);
    const other = await register(a, {
      username: "bob",
      email: "bob@test.com",
      password: "password123",
    });
    const slug = await createArticle(a, token);
    await favorite(a, slug, token);

    const mine = await (
      await a.request(`/api/articles/${slug}`, {
        headers: { Authorization: `Token ${token}` },
      })
    ).json();
    expect(mine.article.favorited).toBe(true);
    expect(mine.article.favoritesCount).toBe(1);

    const theirs = await (
      await a.request(`/api/articles/${slug}`, {
        headers: { Authorization: `Token ${other}` },
      })
    ).json();
    expect(theirs.article.favorited).toBe(false);
    expect(theirs.article.favoritesCount).toBe(1);

    const anon = await (await a.request(`/api/articles/${slug}`)).json();
    expect(anon.article.favorited).toBe(false);
    expect(anon.article.favoritesCount).toBe(1);
  });

  it("GET /api/articles?favorited=<username> で絞り込める", async () => {
    const a = app();
    const token = await register(a);
    const other = await register(a, {
      username: "bob",
      email: "bob@test.com",
      password: "password123",
    });
    const fav1 = await createArticle(a, token, { ...newArticle, title: "fav one" });
    await createArticle(a, token, { ...newArticle, title: "not fav" });
    await favorite(a, fav1, token);
    await favorite(a, fav1, other);

    const res = await a.request("/api/articles?favorited=jake");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.articlesCount).toBe(1);
    expect(body.articles[0].slug).toBe(fav1);
    expect(body.articles[0].favoritesCount).toBe(2);
    expect(body.articles[0].body).toBeUndefined();

    const none = await (await a.request("/api/articles?favorited=nobody")).json();
    expect(none.articlesCount).toBe(0);
    expect(none.articles).toEqual([]);
  });

  it("GET /api/articles 一覧も認証ユーザーの favorited を返す", async () => {
    const a = app();
    const token = await register(a);
    const other = await register(a, {
      username: "bob",
      email: "bob@test.com",
      password: "password123",
    });
    const slug = await createArticle(a, token);
    await favorite(a, slug, token);

    const mine = await (
      await a.request("/api/articles", {
        headers: { Authorization: `Token ${token}` },
      })
    ).json();
    expect(mine.articles[0].slug).toBe(slug);
    expect(mine.articles[0].favorited).toBe(true);
    expect(mine.articles[0].favoritesCount).toBe(1);

    const theirs = await (
      await a.request("/api/articles", {
        headers: { Authorization: `Token ${other}` },
      })
    ).json();
    expect(theirs.articles[0].favorited).toBe(false);
    expect(theirs.articles[0].favoritesCount).toBe(1);
  });
});

describe("GET /api/articles/feed", () => {
  const authed = (a: ReturnType<typeof app>, token: string, query = "") =>
    a.request(`/api/articles/feed${query}`, {
      headers: { Authorization: `Token ${token}` },
    });
  const follow = (a: ReturnType<typeof app>, token: string, username: string) =>
    a.request(`/api/profiles/${username}/follow`, {
      method: "POST",
      headers: { Authorization: `Token ${token}` },
    });
  const user = (username: string) => ({
    username,
    email: `${username}@test.com`,
    password: "password123",
  });

  it("未認証は 401 errors.token を返す", async () => {
    const res = await app().request("/api/articles/feed");
    expect(res.status).toBe(401);
    expect((await res.json()).errors.token[0]).toBe("is missing");
  });

  it("フォロー中ユーザーの記事だけを作成日時の降順で返し、body は含まない", async () => {
    const a = app();
    const main = await register(a);
    const celeb = await register(a, user("celeb"));
    const other = await register(a, user("other"));
    const slug1 = await createArticle(a, celeb, { ...newArticle, title: "c1" });
    const slug2 = await createArticle(a, celeb, { ...newArticle, title: "c2" });
    await createArticle(a, other, { ...newArticle, title: "not followed" });
    // 自分の記事はフォローしていないので feed に出ない
    await createArticle(a, main, { ...newArticle, title: "mine" });

    let body = await (await authed(a, main)).json();
    expect(body.articles).toEqual([]);
    expect(body.articlesCount).toBe(0);

    await follow(a, main, "celeb");
    const res = await authed(a, main);
    expect(res.status).toBe(200);
    body = await res.json();
    expect(body.articlesCount).toBe(2);
    expect(body.articles.map((x: { slug: string }) => x.slug)).toEqual([slug2, slug1]);
    expect(body.articles[0].body).toBeUndefined();
    expect(body.articles[0].author).toMatchObject({ username: "celeb", following: true });
  });

  it("limit / offset は一覧と同じ規則(既定 20、範囲外は 422)", async () => {
    const a = app();
    const main = await register(a);
    const celeb = await register(a, user("celeb"));
    await follow(a, main, "celeb");
    for (const title of ["p1", "p2", "p3"]) {
      await createArticle(a, celeb, { ...newArticle, title });
    }

    const page = await (await authed(a, main, "?limit=2&offset=1")).json();
    expect(page.articlesCount).toBe(3);
    expect(page.articles.map((x: { title: string }) => x.title)).toEqual(["p2", "p1"]);

    for (const q of ["limit=0", "limit=101", "offset=-1", "limit=abc"]) {
      expect((await authed(a, main, `?${q}`)).status).toBe(422);
    }
  });
});

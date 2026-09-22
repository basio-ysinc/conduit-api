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
  tagList: ["dragons", "training"],
};

function postArticle(a: ReturnType<typeof app>, token: string, article = newArticle) {
  return a.request("/api/articles", {
    method: "POST",
    headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ article }),
  });
}

describe("POST /api/articles", () => {
  it("作成でき、slug・tagList・author・favorited/favoritesCount を返す", async () => {
    const a = app();
    const token = await register(a);
    const res = await postArticle(a, token);
    expect(res.status).toBe(201);
    const { article } = await res.json();
    expect(article.slug).toBe("how-to-train-your-dragon");
    expect(article.title).toBe(newArticle.title);
    expect(article.description).toBe(newArticle.description);
    expect(article.body).toBe(newArticle.body);
    expect(article.tagList).toEqual(["dragons", "training"]);
    expect(article.favorited).toBe(false);
    expect(article.favoritesCount).toBe(0);
    expect(article.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(article.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(article.author).toEqual({
      username: "jake",
      bio: null,
      image: null,
      following: false,
    });
  });

  it("未認証は 401 errors.token を返す", async () => {
    const res = await app().request("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ article: newArticle }),
    });
    expect(res.status).toBe(401);
    expect((await res.json()).errors.token[0]).toBe("is missing");
  });

  it("空の title / description / body は 422 を返す", async () => {
    const a = app();
    const token = await register(a);
    for (const field of ["title", "description", "body"]) {
      const res = await postArticle(a, token, { ...newArticle, [field]: "" });
      expect(res.status).toBe(422);
      expect((await res.json()).errors[field][0]).toBe("can't be blank");
    }
  });

  it("同じタイトルでも衝突しない slug が付く", async () => {
    const a = app();
    const token = await register(a);
    const first = await (await postArticle(a, token)).json();
    const second = await (await postArticle(a, token)).json();
    expect(first.article.slug).toBe("how-to-train-your-dragon");
    expect(second.article.slug).toMatch(/^how-to-train-your-dragon-[0-9a-f]{6}$/);
  });

  it("記号だけのタイトルはランダム接尾辞のみの slug になる", async () => {
    const a = app();
    const token = await register(a);
    const res = await postArticle(a, token, { ...newArticle, title: "!!! ---" });
    const { article } = await res.json();
    expect(article.slug).toMatch(/^[0-9a-f]{6}$/);
  });

  it("日本語タイトルは Unicode slug になる", async () => {
    const a = app();
    const token = await register(a);
    const res = await postArticle(a, token, { ...newArticle, title: "ドラゴンの 育て方" });
    const { article } = await res.json();
    expect(article.slug).toBe("ドラゴンの-育て方");
  });
});

describe("GET /api/articles/:slug", () => {
  it("記事を {article: {..., author: profile}} で返す", async () => {
    const a = app();
    const token = await register(a);
    const slug = (await (await postArticle(a, token)).json()).article.slug;
    const res = await a.request(`/api/articles/${slug}`);
    expect(res.status).toBe(200);
    const { article } = await res.json();
    expect(article.slug).toBe(slug);
    expect(article.body).toBe(newArticle.body);
    expect(article.author.username).toBe("jake");
  });

  it("存在しない slug は 404 errors.article を返す", async () => {
    const res = await app().request("/api/articles/no-such-slug");
    expect(res.status).toBe(404);
    expect((await res.json()).errors.article[0]).toBe("not found");
  });
});

describe("GET /api/articles", () => {
  it("作成日時の降順で返し、body は含まない", async () => {
    const a = app();
    const token = await register(a);
    await postArticle(a, token, { ...newArticle, title: "first" });
    await postArticle(a, token, { ...newArticle, title: "second" });
    const res = await a.request("/api/articles");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.articlesCount).toBe(2);
    expect(body.articles.map((x: { title: string }) => x.title)).toEqual(["second", "first"]);
    expect(body.articles[0].body).toBeUndefined();
    expect(body.articles[0].author.username).toBe("jake");
  });

  it("author / tag クエリで絞り込める", async () => {
    const a = app();
    const tokenA = await register(a);
    const tokenB = await register(a, {
      username: "bob",
      email: "bob@test.com",
      password: "password123",
    });
    await postArticle(a, tokenA, { ...newArticle, title: "a1", tagList: ["x"] });
    await postArticle(a, tokenB, { ...newArticle, title: "b1", tagList: ["y"] });

    const byAuthor = await (await a.request("/api/articles?author=jake")).json();
    expect(byAuthor.articlesCount).toBe(1);
    expect(byAuthor.articles[0].title).toBe("a1");

    const byTag = await (await a.request("/api/articles?tag=y")).json();
    expect(byTag.articlesCount).toBe(1);
    expect(byTag.articles[0].title).toBe("b1");

    const none = await (await a.request("/api/articles?author=nobody")).json();
    expect(none.articlesCount).toBe(0);
    expect(none.articles).toEqual([]);
  });

  it("limit / offset でページングでき、範囲外は 422 を返す", async () => {
    const a = app();
    const token = await register(a);
    for (const title of ["p1", "p2", "p3"]) {
      await postArticle(a, token, { ...newArticle, title });
    }
    const page = await (await a.request("/api/articles?limit=2&offset=1")).json();
    expect(page.articlesCount).toBe(3);
    expect(page.articles.map((x: { title: string }) => x.title)).toEqual(["p2", "p1"]);

    for (const q of ["limit=0", "limit=101", "offset=-1", "limit=abc"]) {
      const res = await a.request(`/api/articles?${q}`);
      expect(res.status).toBe(422);
    }
  });
});

describe("PUT /api/articles/:slug", () => {
  it("部分更新でき、title を変えても slug は変わらない", async () => {
    const a = app();
    const token = await register(a);
    const slug = (await (await postArticle(a, token)).json()).article.slug;
    const res = await a.request(`/api/articles/${slug}`, {
      method: "PUT",
      headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ article: { title: "A brand new title" } }),
    });
    expect(res.status).toBe(200);
    const { article } = await res.json();
    expect(article.slug).toBe(slug);
    expect(article.title).toBe("A brand new title");
    expect(article.tagList).toEqual(["dragons", "training"]);
  });

  it("updatedAt は進み createdAt は変わらない", async () => {
    const a = app();
    const token = await register(a);
    const created = (await (await postArticle(a, token)).json()).article;
    const res = await a.request(`/api/articles/${created.slug}`, {
      method: "PUT",
      headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ article: { body: "new body" } }),
    });
    const { article } = await res.json();
    expect(article.createdAt).toBe(created.createdAt);
    expect(article.updatedAt).not.toBe(created.updatedAt);
  });

  it("tagList を送らなければタグは保持され、[] なら全削除される", async () => {
    const a = app();
    const token = await register(a);
    const slug = (await (await postArticle(a, token)).json()).article.slug;
    const put = (article: Record<string, unknown>) =>
      a.request(`/api/articles/${slug}`, {
        method: "PUT",
        headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ article }),
      });

    let body = await (await put({ body: "no tags touched" })).json();
    expect(body.article.tagList).toEqual(["dragons", "training"]);

    body = await (await put({ tagList: [] })).json();
    expect(body.article.tagList).toEqual([]);

    body = await (await put({ tagList: ["one", "two", "one"] })).json();
    expect(body.article.tagList).toEqual(["one", "two"]);
  });

  it("tagList: null は 422 を返す", async () => {
    const a = app();
    const token = await register(a);
    const slug = (await (await postArticle(a, token)).json()).article.slug;
    const res = await a.request(`/api/articles/${slug}`, {
      method: "PUT",
      headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ article: { tagList: null } }),
    });
    expect(res.status).toBe(422);
  });

  it("作者以外は 403、存在しない slug は 404、未認証は 401 を返す", async () => {
    const a = app();
    const tokenA = await register(a);
    const tokenB = await register(a, {
      username: "bob",
      email: "bob@test.com",
      password: "password123",
    });
    const slug = (await (await postArticle(a, tokenA)).json()).article.slug;
    const put = (token: string | null, target = slug) =>
      a.request(`/api/articles/${target}`, {
        method: "PUT",
        headers: {
          ...(token ? { Authorization: `Token ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ article: { body: "x" } }),
      });

    const forbidden = await put(tokenB);
    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).errors.article[0]).toBe("forbidden");
    expect((await put(tokenA, "no-such")).status).toBe(404);
    expect((await put(null)).status).toBe(401);
  });
});

describe("DELETE /api/articles/:slug", () => {
  it("作者は削除でき、その後 GET は 404 を返す", async () => {
    const a = app();
    const token = await register(a);
    const slug = (await (await postArticle(a, token)).json()).article.slug;
    const res = await a.request(`/api/articles/${slug}`, {
      method: "DELETE",
      headers: { Authorization: `Token ${token}` },
    });
    expect(res.status).toBe(204);
    expect((await a.request(`/api/articles/${slug}`)).status).toBe(404);
  });

  it("作者以外は 403、存在しない slug は 404、未認証は 401 を返す", async () => {
    const a = app();
    const tokenA = await register(a);
    const tokenB = await register(a, {
      username: "bob",
      email: "bob@test.com",
      password: "password123",
    });
    const slug = (await (await postArticle(a, tokenA)).json()).article.slug;
    const del = (token: string | null, target = slug) =>
      a.request(`/api/articles/${target}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Token ${token}` } : {},
      });

    const forbidden = await del(tokenB);
    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).errors.article[0]).toBe("forbidden");
    expect((await del(tokenA, "no-such")).status).toBe(404);
    expect((await del(null)).status).toBe(401);
    // 403 の記事は残っている
    expect((await a.request(`/api/articles/${slug}`)).status).toBe(200);
  });
});

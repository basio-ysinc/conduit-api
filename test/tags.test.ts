import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db/index.js";

function app() {
  return createApp(openDatabase(":memory:"));
}

async function register(a: ReturnType<typeof app>) {
  const res = await a.request("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: { username: "jake", email: "jake@test.com", password: "password123" },
    }),
  });
  return (await res.json()).user.token as string;
}

function postArticle(a: ReturnType<typeof app>, token: string, tagList: string[], title = "t") {
  return a.request("/api/articles", {
    method: "POST",
    headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      article: { title, description: "d", body: "b", tagList },
    }),
  });
}

describe("GET /api/tags", () => {
  it("タグが無ければ空配列を返す(認証不要)", async () => {
    const res = await app().request("/api/tags");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tags: [] });
  });

  it("記事に使われているタグだけを重複なく返す", async () => {
    const a = app();
    const token = await register(a);
    await postArticle(a, token, ["dragons", "training"], "a1");
    await postArticle(a, token, ["dragons"], "a2");
    const res = await a.request("/api/tags");
    expect(res.status).toBe(200);
    const { tags } = await res.json();
    expect(tags.sort()).toEqual(["dragons", "training"]);
  });

  it("使用数の降順、同数は名前の昇順で返す", async () => {
    const a = app();
    const token = await register(a);
    // beta: 3 記事 / alpha: 2 記事 / gamma: 2 記事 / delta: 1 記事
    await postArticle(a, token, ["delta", "beta"], "a1");
    await postArticle(a, token, ["gamma", "beta", "alpha"], "a2");
    await postArticle(a, token, ["beta", "alpha", "gamma"], "a3");
    const { tags } = await (await a.request("/api/tags")).json();
    expect(tags).toEqual(["beta", "alpha", "gamma", "delta"]);
  });

  it("記事を削除するとどの記事にも使われないタグは返らない", async () => {
    const a = app();
    const token = await register(a);
    const created = await (await postArticle(a, token, ["gone", "stay"])).json();
    await postArticle(a, token, ["stay"], "a2");
    await a.request(`/api/articles/${created.article.slug}`, {
      method: "DELETE",
      headers: { Authorization: `Token ${token}` },
    });
    const { tags } = await (await a.request("/api/tags")).json();
    expect(tags).toEqual(["stay"]);
  });
});

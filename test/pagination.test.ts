import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db/index.js";
import { parsePagination } from "../src/lib/pagination.js";

describe("parsePagination", () => {
  it("defaults to limit=20, offset=0", () => {
    expect(parsePagination({})).toEqual({ ok: true, value: { limit: 20, offset: 0 } });
  });

  it("accepts valid limit/offset", () => {
    expect(parsePagination({ limit: "1", offset: "5" })).toEqual({
      ok: true,
      value: { limit: 1, offset: 5 },
    });
    expect(parsePagination({ limit: "100" })).toEqual({
      ok: true,
      value: { limit: 100, offset: 0 },
    });
  });

  it("clamps limit above the max to 100", () => {
    expect(parsePagination({ limit: "101" })).toEqual({
      ok: true,
      value: { limit: 100, offset: 0 },
    });
  });

  it.each(["0", "-1", "abc", "1.5", ""])("rejects limit=%s", (limit) => {
    const res = parsePagination({ limit });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.limit).toBeDefined();
  });

  it.each(["-1", "abc", "1.5", ""])("rejects offset=%s", (offset) => {
    const res = parsePagination({ offset });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.offset).toBeDefined();
  });
});

async function registerUser(app: ReturnType<typeof createApp>, name: string) {
  const res = await app.request("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: { username: name, email: `${name}@test.com`, password: "password123" },
    }),
  });
  expect(res.status).toBe(201);
  return (await res.json()).user.token as string;
}

async function createArticle(app: ReturnType<typeof createApp>, token: string, title: string) {
  const res = await app.request("/api/articles", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
    body: JSON.stringify({
      article: { title, description: "d", body: "b" },
    }),
  });
  expect(res.status).toBe(201);
  return (await res.json()).article.slug as string;
}

describe("GET /api/articles pagination", () => {
  it("applies limit/offset and returns filtered total in articlesCount", async () => {
    const app = createApp(openDatabase(":memory:"));
    const token = await registerUser(app, "pager");
    const slug1 = await createArticle(app, token, "First Article");
    const slug2 = await createArticle(app, token, "Second Article");

    const page1 = await app.request("/api/articles?author=pager&limit=1");
    expect(page1.status).toBe(200);
    const body1 = await page1.json();
    expect(body1.articles).toHaveLength(1);
    expect(body1.articlesCount).toBe(2);
    expect(body1.articles[0].slug).toBe(slug2);

    const page2 = await app.request("/api/articles?author=pager&limit=1&offset=1");
    const body2 = await page2.json();
    expect(body2.articles[0].slug).toBe(slug1);
    expect(body2.articlesCount).toBe(2);
  });

  it("returns 422 for invalid limit/offset", async () => {
    const app = createApp(openDatabase(":memory:"));
    for (const q of ["limit=0", "limit=abc", "offset=-1"]) {
      const res = await app.request(`/api/articles?${q}`);
      expect(res.status).toBe(422);
      expect(await res.json()).toMatchObject({ errors: expect.any(Object) });
    }
  });
});

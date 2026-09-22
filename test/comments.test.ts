import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db/index.js";

const app = createApp(openDatabase(":memory:"));

async function register(suffix: string): Promise<string> {
  const res = await app.request("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: {
        username: `t_${suffix}`,
        email: `t_${suffix}@test.com`,
        password: "password123",
      },
    }),
  });
  expect(res.status).toBe(201);
  return (await res.json()).user.token;
}

async function createArticle(token: string, suffix: string): Promise<string> {
  const res = await app.request("/api/articles", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
    body: JSON.stringify({
      article: { title: `Article ${suffix}`, description: "d", body: "b" },
    }),
  });
  expect(res.status).toBe(201);
  return (await res.json()).article.slug;
}

const auth = (token: string) => ({ Authorization: `Token ${token}` });

describe("comments", () => {
  it("creates, lists and deletes a comment", async () => {
    const token = await register("crud");
    const slug = await createArticle(token, "crud");

    const created = await app.request(`/api/articles/${slug}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth(token) },
      body: JSON.stringify({ comment: { body: "hello" } }),
    });
    expect(created.status).toBe(201);
    const { comment } = await created.json();
    expect(comment.id).toBeTypeOf("number");
    expect(comment.body).toBe("hello");
    expect(comment.author.username).toBe("t_crud");

    const listed = await app.request(`/api/articles/${slug}/comments`);
    expect(listed.status).toBe(200);
    expect((await listed.json()).comments).toHaveLength(1);

    const deleted = await app.request(`/api/articles/${slug}/comments/${comment.id}`, {
      method: "DELETE",
      headers: auth(token),
    });
    expect(deleted.status).toBe(204);
    const after = await app.request(`/api/articles/${slug}/comments`);
    expect((await after.json()).comments).toHaveLength(0);
  });

  it("requires auth to create or delete comments", async () => {
    const res = await app.request("/api/articles/whatever/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: { body: "x" } }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ errors: { token: ["is missing"] } });

    const del = await app.request("/api/articles/whatever/comments/1", { method: "DELETE" });
    expect(del.status).toBe(401);
  });

  it("validates comment body and article existence", async () => {
    const token = await register("val");
    const slug = await createArticle(token, "val");

    const blank = await app.request(`/api/articles/${slug}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth(token) },
      body: JSON.stringify({ comment: { body: "" } }),
    });
    expect(blank.status).toBe(422);
    expect(await blank.json()).toEqual({ errors: { body: ["can't be blank"] } });

    const missing = await app.request("/api/articles/nope/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth(token) },
      body: JSON.stringify({ comment: { body: "x" } }),
    });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ errors: { article: ["not found"] } });

    const listMissing = await app.request("/api/articles/nope/comments");
    expect(listMissing.status).toBe(404);
  });
});

describe("authorization", () => {
  it("forbids modifying another user's article or comment", async () => {
    const tokenA = await register("owner");
    const tokenB = await register("other");
    const slug = await createArticle(tokenA, "authz");

    const del = await app.request(`/api/articles/${slug}`, {
      method: "DELETE",
      headers: auth(tokenB),
    });
    expect(del.status).toBe(403);
    expect(await del.json()).toEqual({ errors: { article: ["forbidden"] } });

    const put = await app.request(`/api/articles/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...auth(tokenB) },
      body: JSON.stringify({ article: { body: "hijacked" } }),
    });
    expect(put.status).toBe(403);

    const created = await app.request(`/api/articles/${slug}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth(tokenA) },
      body: JSON.stringify({ comment: { body: "A's comment" } }),
    });
    const { comment } = await created.json();

    const delComment = await app.request(`/api/articles/${slug}/comments/${comment.id}`, {
      method: "DELETE",
      headers: auth(tokenB),
    });
    expect(delComment.status).toBe(403);
    expect(await delComment.json()).toEqual({ errors: { comment: ["forbidden"] } });

    const missingComment = await app.request(`/api/articles/${slug}/comments/99999`, {
      method: "DELETE",
      headers: auth(tokenA),
    });
    expect(missingComment.status).toBe(404);
    expect(await missingComment.json()).toEqual({ errors: { comment: ["not found"] } });
  });
});

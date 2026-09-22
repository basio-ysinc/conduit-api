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
  const body = await res.json();
  return body.user.token as string;
}

const auth = (token: string) => ({ Authorization: `Token ${token}` });

describe("GET /api/profiles/:username", () => {
  it("未認証でもプロフィールを返し、following は false", async () => {
    const a = app();
    await register(a, { username: "celeb", email: "celeb@test.com", password: "password123" });
    const res = await a.request("/api/profiles/celeb");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile).toEqual({ username: "celeb", bio: null, image: null, following: false });
  });

  it("認証済みでフォローしていなければ following は false、フォロー後は true", async () => {
    const a = app();
    const token = await register(a);
    await register(a, { username: "celeb", email: "celeb@test.com", password: "password123" });
    const get = () => a.request("/api/profiles/celeb", { headers: auth(token) });
    expect((await (await get()).json()).profile.following).toBe(false);
    await a.request("/api/profiles/celeb/follow", { method: "POST", headers: auth(token) });
    expect((await (await get()).json()).profile.following).toBe(true);
  });

  it("不正なトークンは 401 errors.token を返す", async () => {
    const a = app();
    await register(a, { username: "celeb", email: "celeb@test.com", password: "password123" });
    const res = await a.request("/api/profiles/celeb", { headers: auth("garbage") });
    expect(res.status).toBe(401);
    expect((await res.json()).errors.token[0]).toBe("is invalid");
  });

  it("存在しないユーザーは 404 errors.profile を返す", async () => {
    const res = await app().request("/api/profiles/nobody");
    expect(res.status).toBe(404);
    expect((await res.json()).errors.profile[0]).toBe("not found");
  });
});

describe("POST /api/profiles/:username/follow", () => {
  it("フォローでき、following: true のプロフィールを返す", async () => {
    const a = app();
    const token = await register(a);
    await register(a, { username: "celeb", email: "celeb@test.com", password: "password123" });
    const res = await a.request("/api/profiles/celeb/follow", {
      method: "POST",
      headers: auth(token),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).profile.following).toBe(true);
  });

  it("冪等: 二度フォローしても 200 で following は true のまま", async () => {
    const a = app();
    const token = await register(a);
    await register(a, { username: "celeb", email: "celeb@test.com", password: "password123" });
    const follow = () =>
      a.request("/api/profiles/celeb/follow", { method: "POST", headers: auth(token) });
    await follow();
    const res = await follow();
    expect(res.status).toBe(200);
    expect((await res.json()).profile.following).toBe(true);
  });

  it("自分自身のフォローは 422 を返す", async () => {
    const a = app();
    const token = await register(a);
    const res = await a.request("/api/profiles/jake/follow", {
      method: "POST",
      headers: auth(token),
    });
    expect(res.status).toBe(422);
  });

  it("未認証は 401 errors.token を返す", async () => {
    const res = await app().request("/api/profiles/anyone/follow", { method: "POST" });
    expect(res.status).toBe(401);
    expect((await res.json()).errors.token[0]).toBe("is missing");
  });

  it("存在しないユーザーは 404 errors.profile を返す", async () => {
    const a = app();
    const token = await register(a);
    const res = await a.request("/api/profiles/nobody/follow", {
      method: "POST",
      headers: auth(token),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).errors.profile[0]).toBe("not found");
  });
});

describe("DELETE /api/profiles/:username/follow", () => {
  it("フォロー解除でき、following: false のプロフィールを返す", async () => {
    const a = app();
    const token = await register(a);
    await register(a, { username: "celeb", email: "celeb@test.com", password: "password123" });
    const headers = auth(token);
    await a.request("/api/profiles/celeb/follow", { method: "POST", headers });
    const res = await a.request("/api/profiles/celeb/follow", { method: "DELETE", headers });
    expect(res.status).toBe(200);
    expect((await res.json()).profile.following).toBe(false);
  });

  it("冪等: フォローしていなくても 200 で following は false", async () => {
    const a = app();
    const token = await register(a);
    await register(a, { username: "celeb", email: "celeb@test.com", password: "password123" });
    const res = await a.request("/api/profiles/celeb/follow", {
      method: "DELETE",
      headers: auth(token),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).profile.following).toBe(false);
  });

  it("未認証は 401 errors.token を返す", async () => {
    const res = await app().request("/api/profiles/anyone/follow", { method: "DELETE" });
    expect(res.status).toBe(401);
    expect((await res.json()).errors.token[0]).toBe("is missing");
  });

  it("存在しないユーザーは 404 errors.profile を返す", async () => {
    const a = app();
    const token = await register(a);
    const res = await a.request("/api/profiles/nobody/follow", {
      method: "DELETE",
      headers: auth(token),
    });
    expect(res.status).toBe(404);
    expect((await res.json()).errors.profile[0]).toBe("not found");
  });
});

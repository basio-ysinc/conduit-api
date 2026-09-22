import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db/index.js";

function app() {
  return createApp(openDatabase(":memory:"));
}

const newUser = {
  username: "jake",
  email: "jake@test.com",
  password: "password123",
};

async function register(a: ReturnType<typeof app>, user = newUser) {
  return a.request("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user }),
  });
}

async function registerAndGetToken(a: ReturnType<typeof app>) {
  const res = await register(a);
  const body = await res.json();
  return body.user.token as string;
}

describe("POST /api/users", () => {
  it("登録でき、{user:{email,token,username,bio,image}} を返す", async () => {
    const res = await register(app());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe("jake@test.com");
    expect(body.user.username).toBe("jake");
    expect(body.user.bio).toBeNull();
    expect(body.user.image).toBeNull();
    expect(typeof body.user.token).toBe("string");
    expect(body.user.token.length).toBeGreaterThan(0);
  });

  it("空の username / email / password は 422 を返す", async () => {
    for (const field of ["username", "email", "password"]) {
      const res = await register(app(), { ...newUser, [field]: "" });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.errors[field][0]).toBe("can't be blank");
    }
  });

  it("8 文字未満の password は 422 を返す", async () => {
    const res = await register(app(), { ...newUser, password: "short7c" });
    expect(res.status).toBe(422);
  });

  it("重複した email / username は 409 を返す", async () => {
    const a = app();
    await register(a);
    const dupUsername = await register(a, { ...newUser, email: "other@test.com" });
    expect(dupUsername.status).toBe(409);
    expect((await dupUsername.json()).errors.username[0]).toBe("has already been taken");
    const dupEmail = await register(a, { ...newUser, username: "other" });
    expect(dupEmail.status).toBe(409);
    expect((await dupEmail.json()).errors.email[0]).toBe("has already been taken");
  });
});

describe("POST /api/users/login", () => {
  it("ログインでき、登録と同じ形のレスポンスを返す", async () => {
    const a = app();
    await register(a);
    const res = await a.request("/api/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: { email: newUser.email, password: newUser.password } }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.username).toBe("jake");
    expect(typeof body.user.token).toBe("string");
  });

  it("パスワードが違うと 401 errors.credentials を返す", async () => {
    const a = app();
    await register(a);
    const res = await a.request("/api/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: { email: newUser.email, password: "wrong-password" } }),
    });
    expect(res.status).toBe(401);
    expect((await res.json()).errors.credentials[0]).toBe("invalid");
  });
});

describe("GET /api/user", () => {
  it("Authorization: Token で現在のユーザーを返す", async () => {
    const a = app();
    const token = await registerAndGetToken(a);
    const res = await a.request("/api/user", {
      headers: { Authorization: `Token ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe("jake@test.com");
    expect(body.user.username).toBe("jake");
  });

  it("未認証は 401 errors.token を返す", async () => {
    const res = await app().request("/api/user");
    expect(res.status).toBe(401);
    expect((await res.json()).errors.token[0]).toBe("is missing");
  });

  it("不正なトークンは 401 を返す", async () => {
    const res = await app().request("/api/user", {
      headers: { Authorization: "Token not-a-real-token" },
    });
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/user", () => {
  it("部分更新できる。空文字は null に正規化される", async () => {
    const a = app();
    const token = await registerAndGetToken(a);
    const put = (user: Record<string, unknown>) =>
      a.request("/api/user", {
        method: "PUT",
        headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user }),
      });

    let res = await put({ bio: "hello", image: "https://x.test/a.png" });
    expect(res.status).toBe(200);
    let body = await res.json();
    expect(body.user.bio).toBe("hello");
    expect(body.user.image).toBe("https://x.test/a.png");
    expect(body.user.username).toBe("jake");

    res = await put({ bio: "", image: null });
    expect(res.status).toBe(200);
    body = await res.json();
    expect(body.user.bio).toBeNull();
    expect(body.user.image).toBeNull();

    expect((await put({ email: "" })).status).toBe(422);
    expect((await put({ username: null })).status).toBe(422);
    expect((await put({ password: "short7c" })).status).toBe(422);
  });

  it("password を更新すると新しいパスワードでログインできる", async () => {
    const a = app();
    const token = await registerAndGetToken(a);
    const res = await a.request("/api/user", {
      method: "PUT",
      headers: { Authorization: `Token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user: { password: "new-password-9" } }),
    });
    expect(res.status).toBe(200);
    const login = await a.request("/api/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: { email: newUser.email, password: "new-password-9" } }),
    });
    expect(login.status).toBe(200);
  });
});

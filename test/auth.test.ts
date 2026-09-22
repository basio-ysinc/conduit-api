import { describe, expect, it } from "vitest";
import { issueToken, verifyToken } from "../src/auth/jwt.js";
import { hashPassword, verifyPassword } from "../src/auth/passwords.js";

describe("hashPassword / verifyPassword", () => {
  it("平文を保存せず scrypt 形式でハッシュ化し、同じパスワードを検証できる", () => {
    const stored = hashPassword("password123");
    expect(stored).toMatch(/^scrypt:\d+:\d+:\d+:[0-9a-f]+:[0-9a-f]+$/);
    expect(stored).not.toContain("password123");
    expect(verifyPassword("password123", stored)).toBe(true);
  });

  it("間違ったパスワードを拒否する", () => {
    expect(verifyPassword("wrong-password", hashPassword("password123"))).toBe(false);
  });

  it("毎回異なるソルトを使う", () => {
    expect(hashPassword("password123")).not.toBe(hashPassword("password123"));
  });

  it("形式不正なハッシュを拒否する", () => {
    expect(verifyPassword("password123", "not-a-hash")).toBe(false);
    expect(verifyPassword("password123", "scrypt::::")).toBe(false);
    expect(verifyPassword("password123", "scrypt:a:b:c:d:e")).toBe(false);
  });
});

describe("issueToken / verifyToken", () => {
  const secret = "test-secret";

  it("発行したトークンからユーザー ID を検証できる", async () => {
    const token = await issueToken(42, secret);
    expect(await verifyToken(token, secret)).toBe(42);
  });

  it("別の鍵で署名されたトークンを拒否する", async () => {
    const token = await issueToken(42, secret);
    expect(await verifyToken(token, "another-secret")).toBeNull();
  });

  it("期限切れのトークンを拒否する", async () => {
    const token = await issueToken(42, secret, -1);
    expect(await verifyToken(token, secret)).toBeNull();
  });

  it("形式不正なトークンを拒否する", async () => {
    expect(await verifyToken("not-a-jwt", secret)).toBeNull();
    expect(await verifyToken("aaa.bbb.ccc", secret)).toBeNull();
  });
});

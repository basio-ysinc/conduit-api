import type { Db } from "../db/index.js";
import { hashPassword } from "../lib/password.js";

export type UserRow = {
  id: number;
  username: string;
  email: string;
  bio: string | null;
  image: string | null;
};

export function createUser(
  db: Db,
  input: { username: string; email: string; password: string },
): { ok: true; user: UserRow } | { ok: false; conflict: "username" | "email" } {
  const existing = db
    .prepare("SELECT username, email FROM users WHERE username = ? OR email = ?")
    .get(input.username, input.email) as { username: string; email: string } | undefined;
  if (existing) {
    return {
      ok: false,
      conflict: existing.username === input.username ? "username" : "email",
    };
  }
  const now = new Date().toISOString();
  const result = db
    .prepare(
      "INSERT INTO users (username, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(input.username, input.email, hashPassword(input.password), now, now);
  const user = db
    .prepare("SELECT id, username, email, bio, image FROM users WHERE id = ?")
    .get(result.lastInsertRowid) as UserRow;
  return { ok: true, user };
}

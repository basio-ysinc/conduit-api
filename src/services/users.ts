import { hashPassword, verifyPassword } from "../auth/passwords.js";
import type { Db } from "../db/index.js";

export type UserRow = {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  bio: string | null;
  image: string | null;
  created_at: string;
  updated_at: string;
};

/** email / username の UNIQUE 制約違反。field はエラーレスポンスのキーに使う。 */
export class ConflictError extends Error {
  constructor(public readonly field: "email" | "username") {
    super(`${field} has already been taken`);
  }
}

export function findUserById(db: Db, id: number): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function findUserByEmail(db: Db, email: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

export function createUser(
  db: Db,
  input: { username: string; email: string; password: string },
): UserRow {
  try {
    const result = db
      .prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)")
      .run(input.username, input.email, hashPassword(input.password));
    return findUserById(db, Number(result.lastInsertRowid)) as UserRow;
  } catch (e) {
    throw toConflict(e);
  }
}

export function authenticateUser(db: Db, email: string, password: string): UserRow | undefined {
  const user = findUserByEmail(db, email);
  if (!user || !verifyPassword(password, user.password_hash)) return undefined;
  return user;
}

export type UpdateUserPatch = {
  username?: string;
  email?: string;
  password?: string;
  bio?: string | null;
  image?: string | null;
};

/** 指定されたフィールドだけ部分更新する。undefined は「送られていない」= 変更しない。 */
export function updateUser(db: Db, id: number, patch: UpdateUserPatch): UserRow {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.username !== undefined) {
    sets.push("username = ?");
    values.push(patch.username);
  }
  if (patch.email !== undefined) {
    sets.push("email = ?");
    values.push(patch.email);
  }
  if (patch.password !== undefined) {
    sets.push("password_hash = ?");
    values.push(hashPassword(patch.password));
  }
  if (patch.bio !== undefined) {
    sets.push("bio = ?");
    values.push(patch.bio);
  }
  if (patch.image !== undefined) {
    sets.push("image = ?");
    values.push(patch.image);
  }
  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    try {
      db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);
    } catch (e) {
      throw toConflict(e);
    }
  }
  return findUserById(db, id) as UserRow;
}

/** UserResponse の user オブジェクト(decisions.md / openapi.yml の User schema) */
export function userResponse(user: UserRow, token: string) {
  return {
    email: user.email,
    token,
    username: user.username,
    bio: user.bio,
    image: user.image,
  };
}

function toConflict(e: unknown): unknown {
  if (e instanceof Error && e.message.includes("UNIQUE constraint failed")) {
    return new ConflictError(e.message.includes("users.email") ? "email" : "username");
  }
  return e;
}

import type { Db } from "../db/index.js";

export type UserRow = {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  bio: string | null;
  image: string | null;
};

export type Profile = {
  username: string;
  bio: string | null;
  image: string | null;
  following: boolean;
};

export function createUser(
  db: Db,
  input: { username: string; email: string; passwordHash: string },
): UserRow {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      "INSERT INTO users (username, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(input.username, input.email, input.passwordHash, now, now);
  return findUserById(db, Number(info.lastInsertRowid)) as UserRow;
}

export function findUserById(db: Db, id: number): UserRow | null {
  return (db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow) ?? null;
}

export function findUserByUsername(db: Db, username: string): UserRow | null {
  return (db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow) ?? null;
}

export function findUserByEmail(db: Db, email: string): UserRow | null {
  return (db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow) ?? null;
}

export function toProfile(user: UserRow): Profile {
  return { username: user.username, bio: user.bio, image: user.image, following: false };
}

export function toUserResponse(user: UserRow, token: string) {
  return {
    email: user.email,
    token,
    username: user.username,
    bio: user.bio,
    image: user.image,
  };
}

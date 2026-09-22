import type { Db } from "../db/index.js";
import type { UserRow } from "./users.js";

export function findUserByUsername(db: Db, username: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;
}

export function isFollowing(db: Db, followerId: number, followeeId: number): boolean {
  return (
    db
      .prepare("SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?")
      .get(followerId, followeeId) !== undefined
  );
}

/** 冪等: 既にフォロー済みでも成功扱いにする。 */
export function followUser(db: Db, followerId: number, followeeId: number): void {
  db.prepare("INSERT OR IGNORE INTO follows (follower_id, followee_id) VALUES (?, ?)").run(
    followerId,
    followeeId,
  );
}

/** 冪等: フォローしていなくても成功扱いにする。 */
export function unfollowUser(db: Db, followerId: number, followeeId: number): void {
  db.prepare("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?").run(
    followerId,
    followeeId,
  );
}

/** ProfileResponse の profile オブジェクト(openapi.yml の Profile schema) */
export function profileResponse(user: UserRow, following: boolean) {
  return {
    username: user.username,
    bio: user.bio,
    image: user.image,
    following,
  };
}

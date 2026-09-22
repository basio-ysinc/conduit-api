import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/index.js";
import { createArticle } from "../src/services/articles.js";
import { createUser } from "../src/services/users.js";

describe("createArticle", () => {
  it("deduplicates tagList entries", () => {
    const db = openDatabase(":memory:");
    const res = createUser(db, {
      username: "author",
      email: "author@test.com",
      password: "password123",
    });
    if (!res.ok) throw new Error("failed to create user");
    const article = createArticle(db, res.user.id, {
      title: "t",
      description: "d",
      body: "b",
      tagList: ["a", "a", "b"],
    });
    expect(article.tagList).toEqual(["a", "b"]);
  });
});

import { Hono } from "hono";
import type { Db } from "./db/index.js";
import { articlesRoutes } from "./routes/articles.js";
import { commentsRoutes } from "./routes/comments.js";
import { usersRoutes } from "./routes/users.js";

export type AppEnv = { Variables: { db: Db } };

/** Hono アプリを組み立てる。ルートは src/routes/ に置き、ここで登録する。 */
export function createApp(db: Db): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.get("/api/health", (c) => c.json({ status: "ok" }));
  app.route("/api/users", usersRoutes);
  app.route("/api/articles", articlesRoutes);
  app.route("/api/articles", commentsRoutes);
  app.notFound((c) => c.json({ errors: { body: ["not found"] } }, 404));
  app.onError((_err, c) => c.json({ errors: { body: ["internal error"] } }, 500));
  return app;
}

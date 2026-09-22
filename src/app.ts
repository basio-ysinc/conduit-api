import { Hono } from "hono";
import type { Db } from "./db/index.js";
import { articlesRoutes } from "./routes/articles.js";
import { usersRoutes } from "./routes/users.js";

export type AppEnv = { Variables: { db: Db; userId?: number } };

/** Hono アプリを組み立てる。ルートは src/routes/ に置き、ここで登録する。 */
export function createApp(db: Db): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.route("/api", usersRoutes);
  app.route("/api", articlesRoutes);
  app.get("/api/health", (c) => c.json({ status: "ok" }));
  app.notFound((c) => c.json({ errors: { body: ["not found"] } }, 404));
  return app;
}

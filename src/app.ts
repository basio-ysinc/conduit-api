import { Hono } from "hono";
import type { Db } from "./db/index.js";
import { userRoutes } from "./routes/user.js";
import { usersRoutes } from "./routes/users.js";
import type { UserRow } from "./services/users.js";

export type AppEnv = { Variables: { db: Db; user: UserRow } };

/** Hono アプリを組み立てる。ルートは src/routes/ に置き、ここで登録する。 */
export function createApp(db: Db): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    await next();
  });
  app.get("/api/health", (c) => c.json({ status: "ok" }));
  app.route("/", usersRoutes);
  app.route("/", userRoutes);
  app.notFound((c) => c.json({ errors: { body: ["not found"] } }, 404));
  app.onError((e, c) => {
    console.error(e);
    return c.json({ errors: { body: ["internal server error"] } }, 500);
  });
  return app;
}

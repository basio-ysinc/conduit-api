import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { resolveJwtSecret } from "./auth/jwt.js";
import { openDatabase } from "./db/index.js";

resolveJwtSecret(); // production で JWT_SECRET 未設定ならここで落ちる(fail fast)

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DATABASE_PATH ?? "./data/conduit.db";
mkdirSync(dirname(dbPath), { recursive: true });
const app = createApp(openDatabase(dbPath));
serve({ fetch: app.fetch, port }, () => {
  console.log(`conduit-api listening on http://localhost:${port} (db: ${dbPath})`);
});

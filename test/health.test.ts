import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db/index.js";

describe("health", () => {
  it("GET /api/health returns ok", async () => {
    const app = createApp(openDatabase(":memory:"));
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("unknown routes return the error envelope", async () => {
    const app = createApp(openDatabase(":memory:"));
    const res = await app.request("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ errors: { body: ["not found"] } });
  });
});

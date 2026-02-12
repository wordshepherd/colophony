import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { type FastifyInstance } from "fastify";
import { buildApp } from "./main.js";
import { type Env } from "./config/env.js";

// Mock @colophony/db to avoid needing a real database for unit tests
vi.mock("@colophony/db", () => ({
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }),
  },
  db: {},
}));

const testEnv: Env = {
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  PORT: 0,
  HOST: "127.0.0.1",
  NODE_ENV: "test",
  LOG_LEVEL: "fatal",
  REDIS_HOST: "localhost",
  REDIS_PORT: 6379,
  REDIS_PASSWORD: "",
  CORS_ORIGIN: "http://localhost:3000",
};

describe("Fastify app", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(testEnv);
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns 200 with status ok", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });

  it("GET /ready returns 200 when DB is reachable", async () => {
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("ready");
  });

  it("GET /ready returns 503 when DB is unreachable", async () => {
    const { pool } = await import("@colophony/db");
    const queryFn = pool.query as ReturnType<typeof vi.fn>;
    queryFn.mockRejectedValueOnce(new Error("connection refused"));

    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
    const body = response.json();
    expect(body.status).toBe("unavailable");
    expect(body.error).toBe("database_unreachable");
  });

  it("GET / returns 200 with API info", async () => {
    const response = await app.inject({ method: "GET", url: "/" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name).toBe("Colophony API");
    expect(body.version).toBe("2.0.0-dev");
  });

  it("GET /nonexistent returns 404", async () => {
    const response = await app.inject({ method: "GET", url: "/nonexistent" });
    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.error).toBe("not_found");
  });

  it("includes CORS headers for allowed origins", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "http://localhost:3000" },
    });
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
  });
});

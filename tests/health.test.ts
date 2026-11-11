import express from "express";
import { createServer } from "node:http";

describe("health routes", () => {
  let app: express.Express;
  let server: ReturnType<typeof createServer>;

  beforeEach(async () => {
    vi.resetModules();
    const { registerHealthRoutes } = await import("../src/dashboard/routes/health.js");
    app = express();
    registerHealthRoutes(app);
    server = createServer(app);
  });

  afterEach(() => {
    vi.clearAllMocks();
    return new Promise<void>((resolve) => {
      if (server.listening) server.close(() => resolve());
      else resolve();
    });
  });

  async function get(path: string): Promise<{ statusCode: number; body: unknown }> {
    return new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        fetch(`http://127.0.0.1:${port}${path}`)
          .then((r) => r.json().then((body) => ({ statusCode: r.status, body })))
          .then(resolve)
          .catch(reject)
          .finally(() => server.close());
      });
    });
  }

  it("GET /health returns 200 with ok: true (no auth)", async () => {
    const res = await get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, dashboard: true });
  });

  it("GET /ready returns 200 when dashboard is ready", async () => {
    const res = await get("/ready");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, dashboard: true });
  });
});

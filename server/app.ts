import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { sql } from "drizzle-orm";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { getDb } from "./db";
import {
  rateLimit,
  requestLog,
  sameOrigin,
  securityHeaders,
} from "./http-security";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Trust only an explicitly configured reverse proxy, never arbitrary forwarded headers.
  if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);
  app.use(requestLog, securityHeaders);
  app.get("/healthz", (_req, res) =>
    res.json({ ok: true, mode: "simulation" })
  );
  app.get("/readyz", async (_req, res) => {
    try {
      const db = await getDb();
      await db.execute(sql`SELECT 1 FROM sessions LIMIT 1`);
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });
  // Legacy OAuth callback is intentionally unregistered. No upstream provider, JWT or dev bypass is accepted.
  app.use("/api", rateLimit(300, 60000), sameOrigin);
  app.use("/api/trpc", (req, res, next) => {
    let path: string;
    try {
      path = decodeURIComponent(req.path);
    } catch {
      res.status(400).json({ error: "Invalid path" });
      return;
    }
    if (/auth\.(login|register)/.test(path)) {
      if (path.includes(",")) {
        res.status(400).json({ error: "Authentication cannot be batched" });
        return;
      }
      return authLimiter(req, res, next);
    }
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  app.use(
    "/api/trpc",
    (req, res, next) => {
      if (req.path.split(",").length > 10) {
        res.status(400).json({ error: "Batch too large" });
        return;
      }
      next();
    },
    createExpressMiddleware({ router: appRouter, createContext })
  );
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const status =
        typeof error === "object" &&
        error &&
        "status" in error &&
        error.status === 413
          ? 413
          : 400;
      res
        .status(status)
        .json({
          error: status === 413 ? "Request too large" : "Invalid request",
        });
    }
  );
  return app;
}
const authLimiter = rateLimit(20, 15 * 60000);

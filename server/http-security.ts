import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { ANDROID_ORIGIN } from "../shared/native-api";
// Single-process Beta limiter: bounded keys, no cookies, emails, URLs or tokens in logs.
export function rateLimit(max: number, windowMs: number): RequestHandler {
  const buckets = new Map<string, { count: number; until: number }>();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of buckets)
      if (value.until <= now) buckets.delete(key);
    const key = req.ip ?? "unknown";
    if (!buckets.has(key) && buckets.size >= 10000) {
      res.status(429).json({ error: "Server busy" });
      return;
    }
    const value = buckets.get(key) ?? { count: 0, until: now + windowMs };
    value.count++;
    buckets.set(key, value);
    if (value.count > max) {
      res.setHeader("Retry-After", Math.ceil((value.until - now) / 1000));
      res.status(429).json({ error: "Too many requests" });
      return;
    }
    next();
  };
}
export const securityHeaders: RequestHandler = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
  }
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  next();
};
export const sameOrigin: RequestHandler = (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") {
    next();
    return;
  }
  const expected = process.env.APP_ORIGIN;
  // Native HTTP uses the same opaque HttpOnly session cookies. This is an
  // explicit transport boundary, never an identity/role or certificate bypass.
  // No CORS permission is issued to browser fetches from localhost.
  const native =
    process.env.ANDROID_API_ENABLED === "true" &&
    req.secure &&
    expected?.startsWith("https://") &&
    req.headers.origin === ANDROID_ORIGIN &&
    req.headers["x-go-pharmacy-client"] === "android" &&
    req.headers["sec-fetch-site"] !== "cross-site";
  if (
    !native &&
    (!expected ||
      req.headers.origin !== expected ||
      req.headers["sec-fetch-site"] === "cross-site")
  ) {
    res.status(403).json({ error: "Same-origin request required" });
    return;
  }
  if (!req.is("application/json")) {
    res.status(415).json({ error: "JSON required" });
    return;
  }
  next();
};
export const requestLog: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  res.setHeader("X-Request-ID", requestId);
  res.on("finish", () =>
    console.log(
      JSON.stringify({
        event: "http",
        requestId,
        method: req.method,
        status: res.statusCode,
      })
    )
  );
  next();
};

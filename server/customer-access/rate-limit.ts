import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { customerAuthMessages } from "../../shared/customer-auth";

// Single-process limiter supplements the HTTP edge, including direct tRPC callers.
// Deployment with multiple processes must supply a shared limiter before scaling.
const buckets = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 15 * 60_000;
export function enforceCustomerAuthLimit(
  operation: "register" | "login" | "request-reset" | "reset",
  req: Request,
  identifier: string
) {
  const now = Date.now();
  for (const [key, value] of buckets)
    if (value.until <= now) buckets.delete(key);
  const keys = [
    {
      key: `${operation}:ip:${req.ip ?? req.socket?.remoteAddress ?? "unknown"}`,
      max: 20,
    },
    {
      key: `${operation}:identity:${createHash("sha256").update(identifier).digest("hex")}`,
      max: operation === "request-reset" ? 5 : 10,
    },
  ];
  if (
    keys.some(({ key, max }) => (buckets.get(key)?.count ?? 0) >= max) ||
    (buckets.size >= 10_000 && keys.some(({ key }) => !buckets.has(key)))
  )
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: customerAuthMessages.rate,
    });
  for (const { key } of keys) {
    const value = buckets.get(key) ?? { count: 0, until: now + WINDOW_MS };
    value.count++;
    buckets.set(key, value);
  }
}

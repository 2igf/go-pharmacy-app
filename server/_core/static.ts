import express, { type Express } from "express";
import path from "node:path";
export function serveStatic(app: Express) {
  const dir = path.resolve(import.meta.dirname, "public");
  app.use(express.static(dir));
  app.get("*", (_req, res) => res.sendFile(path.join(dir, "index.html")));
}

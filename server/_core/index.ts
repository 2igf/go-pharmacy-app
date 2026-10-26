import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "../app";
import { closeDb } from "../db";
import { validateAuthConfig } from "../auth";
async function main() {
  const origin = process.env.APP_ORIGIN;
  if (!origin || !process.env.DATABASE_URL)
    throw new Error("APP_ORIGIN and DATABASE_URL are required");
  validateAuthConfig();
  const parsed = new URL(origin);
  if (
    origin !== parsed.origin ||
    (process.env.NODE_ENV === "production" && parsed.protocol !== "https:")
  )
    throw new Error("APP_ORIGIN must be an origin; production requires HTTPS");
  const app = createApp();
  const server = createServer(app);
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    const { serveStatic } = await import("./static");
    serveStatic(app);
  }
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  server.listen(port, process.env.HOST ?? "127.0.0.1", () =>
    console.log(
      JSON.stringify({ event: "listening", port, mode: "simulation" })
    )
  );
  const stop = () =>
    server.close(async () => {
      await closeDb();
      process.exit(0);
    });
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
main().catch(() => {
  console.error(
    JSON.stringify({
      event: "startup_failed",
      message: "Check environment, database and port configuration",
    })
  );
  process.exitCode = 1;
});

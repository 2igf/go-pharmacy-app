import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      PRIVATE_BETA: "true",
      BETA_ALLOWED_EMAILS:
        "customer-a@example.test,customer-b@example.test,admin@example.test",
    },
    fileParallelism: false,
    maxWorkers: 2,
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
  },
});

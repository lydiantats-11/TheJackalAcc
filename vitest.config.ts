import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Database test files each reset the same test schema, so they must not run in parallel.
    fileParallelism: !process.env.TEST_DATABASE_URL,
  },
});

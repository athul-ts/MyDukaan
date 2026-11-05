import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    // Integration tests share one database, so files must not run at the same time.
    fileParallelism: false,
    testTimeout: 15000,
  },
});

import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Tests run against the module graph directly — no database, no listening
 * socket. Services take their repositories through the constructor, so a test
 * substitutes a fake instead of standing up mongod, and Application.build()
 * returns an app supertest can drive without a port.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.js", "src/**/*.test.js"],
    setupFiles: ["./tests/setup.js"],
    // Feature modules construct controllers and repositories at import time, so
    // an isolated module graph per file keeps one test's fakes out of another's.
    isolate: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      exclude: ["src/**/*.test.js", "src/**/index.js"],
    },
  },
  resolve: {
    alias: {
      "#src": fileURLToPath(new URL("./src", import.meta.url)),
      "#tests": fileURLToPath(new URL("./tests", import.meta.url)),
    },
  },
});

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { alias } from "./aliases.js";

/**
 * Test config, kept separate from vite.config.js.
 *
 * The build config carries the bundle visualiser and a dev-server block that a
 * test run has no use for, and loading it would start those plugins on every
 * `vitest` invocation. Only the aliases need to agree, and they do by importing
 * the same map rather than by being kept in step by hand.
 */
export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.test.{js,jsx}"],
    // The architecture tests read source files off disk rather than importing
    // them, so they must not be run against a transformed module graph.
    restoreMocks: true,
  },
});

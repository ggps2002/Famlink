import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from "rollup-plugin-visualizer";
import { alias } from "./aliases.js";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(),
  visualizer({
    open: false,
    filename: "dist/bundle-report.html",
    gzipSize: true,
    brotliSize: true,
  }),
  ],
  // Shared with vitest.config.js via aliases.js so a module that resolves in the
  // build cannot fail to resolve in a test.
  resolve: { alias },
  build: {
    sourcemap: true, // 👈 add this line
    minify: 'esbuild',
  },
  server: {
    host: '0.0.0.0',      // ← allow external access
    port: 5173,           // optional: default port
    strictPort: true,     // optional: prevent port fallback
  },
})

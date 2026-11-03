import { defineConfig } from "vite";

// Relative paths, so one build runs on GitHub Pages, inside the Cashy site, or zipped for a game portal.
export default defineConfig({
  base: "./",
  build: { target: "es2022" },
  server: { port: 5173, strictPort: true },
});

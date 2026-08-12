import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: {
        home: resolve(import.meta.dirname, "index.html"),
        laboratory: resolve(import.meta.dirname, "app/index.html"),
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
});

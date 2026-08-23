import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "research.spec.mjs",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: process.env.V026C_BASE_URL ?? "http://127.0.0.1:4184",
    colorScheme: "light",
  },
});

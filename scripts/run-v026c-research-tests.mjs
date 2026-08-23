import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { createServer } from "vite";

const projectRoot = resolve(import.meta.dirname, "..");
const port = 4184;
const baseUrl = `http://127.0.0.1:${port}`;
const server = await createServer({
  configFile: resolve(projectRoot, "research/v0.26c/vite.config.mjs"),
  server: { host: "127.0.0.1", port, strictPort: true },
});

let exitCode = 1;
try {
  await server.listen();
  exitCode = await new Promise((resolveExit) => {
    const child = spawn(process.execPath, [
      resolve(projectRoot, "node_modules/@playwright/test/cli.js"),
      "test",
      "--config",
      resolve(projectRoot, "research/v0.26c/playwright.config.mjs"),
    ], {
      cwd: projectRoot,
      env: { ...process.env, V026C_BASE_URL: baseUrl },
      stdio: "inherit",
    });
    child.on("exit", (code) => resolveExit(code ?? 1));
    child.on("error", () => resolveExit(1));
  });
} finally {
  await server.close();
}

process.exitCode = exitCode;

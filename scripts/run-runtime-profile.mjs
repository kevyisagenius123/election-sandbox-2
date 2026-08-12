import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const command = process.execPath;
const playwrightCli = fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url));
const child = spawn(command, [
  playwrightCli,
  "test",
  "tests/browser/runtime-hardening.spec.ts",
  "--grep",
  "deterministic PA and MI session",
], {
  env: { ...process.env, SANDBOX_STRESS_CYCLES: "35" },
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

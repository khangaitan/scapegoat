import { spawn, execSync, type ChildProcess } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rm, writeFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BACKEND = resolve(ROOT, "backend");
const TEST_DB = resolve(BACKEND, "data", "test.db");
const TEST_PORT = "3099";
const TEST_ADMIN_TOKEN = "songolt-test-runner";

let server: ChildProcess;

function killPort(port: string) {
  try { execSync(`fuser -k ${port}/tcp`, { stdio: "pipe" }); } catch { /* nothing on port */ }
}

export async function setup() {
  // Kill any stale backend left from a previous run
  killPort(TEST_PORT);
  await new Promise(r => setTimeout(r, 300));

  // Build backend
  execSync("node ./build.mjs", { cwd: BACKEND, stdio: "pipe" });

  // Clean any leftover test DB
  await rm(TEST_DB, { force: true });

  // Start backend on a dedicated test port
  server = spawn("node", ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: BACKEND,
    env: {
      ...process.env,
      PORT: TEST_PORT,
      ADMIN_TOKEN: TEST_ADMIN_TOKEN,
      SQLITE_PATH: TEST_DB,
      NODE_ENV: "test",
    },
    stdio: "pipe",
  });

  server.stderr?.on("data", () => {}); // suppress pino logs

  // Wait for backend to accept connections
  await waitForBackend(`http://localhost:${TEST_PORT}/api/healthz`, 15_000);

  // Generate a test host code via admin API
  const res = await fetch(`http://localhost:${TEST_PORT}/api/admin/codes`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-token": TEST_ADMIN_TOKEN,
    },
    body: JSON.stringify({ note: "vitest" }),
  });
  const { code } = await res.json() as { code: string };

  // Write config to a temp file — env vars set here don't reach vitest workers
  await writeFile("/tmp/songolt-test-config.json", JSON.stringify({
    backendUrl: `http://localhost:${TEST_PORT}`,
    hostCode: code,
  }));
}

export async function teardown() {
  if (server) {
    const exited = new Promise<void>(r => server.once("exit", () => r()));
    server.kill("SIGTERM");
    await Promise.race([exited, new Promise<void>(r => setTimeout(r, 3000))]);
  }
  await rm(TEST_DB, { force: true });
}

async function waitForBackend(url: string, timeout: number) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Backend did not start within ${timeout}ms`);
}

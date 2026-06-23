import { createServer } from "http";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { setupSocketIO } from "./socketHandler.js";

try {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
} catch { /* .env is optional */ }

const port = Number(process.env.PORT ?? 3001);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT: "${process.env.PORT}"`);

const httpServer = createServer(app);
setupSocketIO(httpServer);

httpServer.listen(port, (err?: Error) => {
  if (err) { logger.error({ err }, "Error listening"); process.exit(1); }
  logger.info({ port }, "Server listening with Socket.IO");
});

import { MongoMemoryServer } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const port = process.env.FRONTEND_PORT || "5173";
const apiPort = process.env.BACKEND_PORT || "8000";
const data = path.resolve(".local", "mongodb");
await mkdir(data, { recursive: true });
const database = process.env.MONGODB_URI
  ? null
  : await MongoMemoryServer.create({
      instance: { dbPath: data, storageEngine: "wiredTiger", ip: "127.0.0.1", launchTimeout: 60000 },
    });
const env = {
  ...process.env,
  MONGODB_URI: process.env.MONGODB_URI || database.getUri(),
  MONGODB_DATABASE: process.env.MONGODB_DATABASE || "akasha_dev",
  APP_ORIGINS: "http://127.0.0.1:" + port + ",http://localhost:" + port,
  COOKIE_SECURE: "0",
};
const python = path.resolve(
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const backend = spawn(
  python,
  [
    "-m",
    "uvicorn",
    "backend.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    apiPort,
  ],
  { env, stdio: "inherit" },
);
const frontend = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    port,
    "--strictPort",
  ],
  {
    stdio: "inherit",
    env: { ...env, API_TARGET: "http://127.0.0.1:" + apiPort },
  },
);
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  frontend.kill();
  backend.kill();
  if (database) await database.stop();
  process.exit(code);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
for (const child of [frontend, backend]) {
  child.on("error", (error) => {
    console.error(error.message);
    void stop(1);
  });
  child.on("exit", (code) => stop(code ?? 1));
}

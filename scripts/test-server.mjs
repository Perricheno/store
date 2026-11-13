import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";

const root = process.cwd();
const base = path.join(root, ".data", "e2e");
await mkdir(base, { recursive: true });
const data = await mkdtemp(path.join(base, "run-"));
const key = path.join(data, "localhost.key");
const cert = path.join(data, "localhost.crt");
const generated = spawnSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    key,
    "-out",
    cert,
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost",
  ],
  { stdio: "ignore" },
);
if (generated.status !== 0)
  throw (
    generated.error || new Error("Failed to generate HTTPS test certificate")
  );
await chmod(key, 0o600);
const env = {
  ...process.env,
  APP_ENV: "test",
  APIPAY_MODE: "mock",
  APIPAY_WEBHOOK_SECRET: "urbanmag-e2e-public-signature-fixture",
  DATABASE_URL: "",
  APP_URL: "https://localhost:3443",
  STAFF_URL: "https://localhost:3443",
  PGLITE_DATA_DIR: path.join(data, "pg"),
  TEST_MAIL_DIR: path.join(base, "mail"),
  MAIL_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  APP_SECRET: randomBytes(32).toString("hex"),
  BOOTSTRAP_OWNER_EMAIL: "owner@urbanmag.test",
  BOOTSTRAP_OWNER_PASSWORD: "E2e-owner-password-2026!",
  UPLOADS_DIR: path.join(data, "uploads"),
};
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "apps/web",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3100",
  ],
  { env, stdio: "inherit" },
);
const server = https.createServer(
  { key: await readFile(key), cert: await readFile(cert) },
  (request, response) => {
    const upstream = http.request(
      {
        hostname: "127.0.0.1",
        port: 3100,
        method: request.method,
        path: request.url,
        headers: { ...request.headers, "x-forwarded-proto": "https" },
      },
      (incoming) => {
        response.writeHead(incoming.statusCode || 502, incoming.headers);
        incoming.pipe(response);
      },
    );
    upstream.on("error", () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    request.pipe(upstream);
  },
);
server.listen(3443, "localhost");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close();
    child.kill(signal);
  });
child.on("exit", (code) => {
  server.close();
  process.exit(code ?? 1);
});

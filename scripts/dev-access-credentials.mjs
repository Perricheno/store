import { hash, Algorithm } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import { appendFile, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Arguments are paths only. Credentials never enter argv, stdout, or subprocesses.
const [environmentFile, secretDirectory] = process.argv.slice(2);
if (!environmentFile || !secretDirectory) throw new Error("Environment and secret directory paths are required");
const environment = await readFile(environmentFile, "utf8");
if (/^DEV_ACCESS_(?:ENABLED|PASSWORD_HASH)=/m.test(environment))
  throw new Error("Development access is already configured; refusing to overwrite it");
await mkdir(secretDirectory, { recursive: true, mode: 0o700 });
await chmod(secretDirectory, 0o700);
// Keep the legacy filename so existing private password records remain valid.
const passwordFile = path.join(secretDirectory, "dev-basic-password");
let password;
try {
  password = (await readFile(passwordFile, "utf8")).replace(/\r?\n$/, "");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  password = randomBytes(32).toString("base64url");
  await writeFile(passwordFile, `${password}\n`, { mode: 0o600, flag: "wx" });
}
if (!password) throw new Error("The existing development access password is empty");
await chmod(passwordFile, 0o600);
const passwordHash = await hash(password, { algorithm: Algorithm.Argon2id });
// Compose interpolates $ in unquoted/double-quoted values; single quotes preserve Argon2 hashes.
await appendFile(environmentFile, `\nDEV_ACCESS_ENABLED=true\nDEV_ACCESS_PASSWORD_HASH='${passwordHash}'\n`, { mode: 0o600 });
await chmod(environmentFile, 0o600);

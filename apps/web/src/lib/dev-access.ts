import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const devCookieName = "__Host-urbanmag_dev_access";
export const devAccessLifetime = 30 * 24 * 60 * 60;
export function devAccessEnabled() {
  return process.env.APP_ENV !== "production" && process.env.DEV_ACCESS_ENABLED === "true";
}
export function devAccessConfigured() {
  return devAccessEnabled() && !!process.env.DEV_ACCESS_PASSWORD_HASH && (process.env.APP_SECRET?.length || 0) >= 32;
}
export function safeDevNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n\u0000]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://dev.invalid");
    if (url.origin !== "https://dev.invalid" || url.pathname.startsWith("/api/dev-access/") || url.pathname.startsWith("/_urbanmag/")) return "/";
    return url.pathname + url.search + url.hash;
  } catch { return "/"; }
}
function signature(payload: string, host: string) {
  return createHmac("sha256", process.env.APP_SECRET!).update(`${host.toLowerCase()}\n${payload}`).digest("base64url");
}
export function createDevAccessToken(host: string) {
  const payload = `${Math.floor(Date.now() / 1000) + devAccessLifetime}.${randomBytes(24).toString("base64url")}`;
  return `${payload}.${signature(payload, host)}`;
}
export function validDevAccessToken(token: string | undefined, host: string) {
  if (!devAccessConfigured() || !token || token.length > 256) return false;
  const [expiry, nonce, mac, extra] = token.split(".");
  if (extra || !/^\d{10}$/.test(expiry || "") || !/^[\w-]{32}$/.test(nonce || "") || !/^[\w-]{43}$/.test(mac || "")) return false;
  const remaining = Number(expiry) - Math.floor(Date.now() / 1000);
  if (remaining <= 0 || remaining > devAccessLifetime) return false;
  return timingSafeEqual(Buffer.from(mac), Buffer.from(signature(`${expiry}.${nonce}`, host)));
}
let globalAttempts = { count: 0, until: 0 };
const attempts = new Map<string, { count: number; until: number }>();
export function allowDevLogin(ip: string) {
  const now = Date.now();
  if (globalAttempts.until <= now) globalAttempts = { count: 0, until: now + 60000 };
  if (++globalAttempts.count > 60) return false;
  for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
  // A global ceiling also limits spoofed-IP memory growth and Argon2 work.
  if (attempts.size >= 10000 && !attempts.has(ip)) return false;
  const key = ip.slice(0, 128);
  const entry = attempts.get(key) || { count: 0, until: now + 60000 };
  attempts.set(key, entry);
  return ++entry.count <= 10;
}

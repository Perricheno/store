import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";
import { CoreError, getSession } from "@urbanmag/core";
import { randomUUID } from "node:crypto";
import { shopOrigin, staffOrigin } from "./config";

export async function realm() {
  return (await headers()).get("x-urbanmag-zone") === "staff"
    ? ("staff" as const)
    : ("buyer" as const);
}
export async function cookieOptions() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure:
      requestHeaders.get("x-forwarded-proto") === "https" ||
      !/^(localhost|127\.0\.0\.1)(:|$)/.test(host),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}
export async function cookieName(kind: string) {
  return `${(await cookieOptions()).secure ? "__Host-" : ""}urbanmag_${kind}`;
}
export async function visitorId() {
  const jar = await cookies();
  const name = await cookieName("visitor");
  const existing = jar.get(name)?.value;
  if (existing && /^[a-f0-9-]{36}$/.test(existing)) return existing;
  const id = randomUUID();
  jar.set(name, id, { ...(await cookieOptions()), maxAge: 60 * 60 * 24 * 90 });
  return id;
}
export async function sessionToken() {
  return (await cookies()).get(await cookieName(await realm()))?.value;
}
export async function currentUser() {
  const token = await sessionToken();
  return token ? getSession(token, await realm()) : null;
}
export async function requireStaff(owner = false) {
  if ((await realm()) !== "staff")
    throw new CoreError(404, "not_found", "Not found");
  const user = await currentUser();
  if (!user || !["owner", "manager"].includes(user.role))
    throw new CoreError(401, "unauthorized", "Войдите в кабинет сотрудников");
  if (user.mustChangePassword)
    throw new CoreError(
      403,
      "password_change_required",
      "Смените временный пароль",
    );
  if (owner && user.role !== "owner")
    throw new CoreError(403, "forbidden", "Недостаточно прав");
  return user;
}
export function assertOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const expected = [shopOrigin(), staffOrigin()];
  if (
    !origin ||
    (!expected.includes(origin) &&
      !(process.env.APP_ENV !== "production" && new URL(origin).host === host))
  )
    throw new CoreError(403, "invalid_origin", "Запрос отклонён");
}
const limits = new Map<string, { count: number; until: number }>();
export function rateLimit(request: NextRequest, action: string, max = 15) {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "local";
  const key = `${action}:${ip}`;
  const now = Date.now();
  if (limits.size > 10000)
    for (const [k, v] of limits) if (v.until < now) limits.delete(k);
  const entry = limits.get(key);
  if (!entry || entry.until < now) {
    limits.set(key, { count: 1, until: now + 60000 });
    return;
  }
  if (++entry.count > max)
    throw new CoreError(
      429,
      "rate_limited",
      "Слишком много запросов. Попробуйте через минуту.",
    );
}
export async function body(request: NextRequest) {
  if (Number(request.headers.get("content-length") || 0) > 131072)
    throw new CoreError(413, "too_large", "Слишком большой запрос");
  const raw = await request.text();
  if (raw.length > 131072)
    throw new CoreError(413, "too_large", "Слишком большой запрос");
  try {
    return JSON.parse(raw);
  } catch {
    throw new CoreError(400, "invalid_json", "Неверный формат запроса");
  }
}

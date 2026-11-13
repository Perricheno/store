import { verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { allowDevLogin, createDevAccessToken, devAccessConfigured, devAccessEnabled, devAccessLifetime, devCookieName, safeDevNext, validDevAccessToken } from "@/lib/dev-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const copy = {
  ru: { title: "Доступ к тестовой версии", description: "Введите пароль для доступа на 30 дней. Вход в аккаунт выполняется отдельно.", password: "Пароль доступа", submit: "Продолжить", error: "Неверный пароль. Попробуйте ещё раз.", limited: "Слишком много попыток. Повторите через минуту.", unavailable: "Доступ временно недоступен.", denied: "Запрос отклонён." },
  kk: { title: "Сынақ нұсқасына кіру", description: "30 күнге кіру үшін құпиясөзді енгізіңіз. Аккаунтқа бөлек кіресіз.", password: "Кіру құпиясөзі", submit: "Жалғастыру", error: "Құпиясөз қате. Қайталап көріңіз.", limited: "Әрекет тым көп. Бір минуттан кейін қайталаңыз.", unavailable: "Кіру уақытша қолжетімсіз.", denied: "Сұрау қабылданбады." },
  en: { title: "Development access", description: "Enter the password for 30 days of access. Account sign-in is separate.", password: "Access password", submit: "Continue", error: "Incorrect password. Please try again.", limited: "Too many attempts. Try again in a minute.", unavailable: "Access is temporarily unavailable.", denied: "Request rejected." },
};
type Lang = keyof typeof copy;
const escape = (text: string) => text.replace(/[&<>"']/g, value => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[value]!);
function language(request: NextRequest): Lang {
  const lang = request.nextUrl.searchParams.get("lang");
  if (lang === "ru" || lang === "kk" || lang === "en") return lang;
  return request.headers.get("accept-language")?.startsWith("kk") ? "kk" : request.headers.get("accept-language")?.startsWith("en") ? "en" : "ru";
}
const privateHeaders = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };
function page(lang: Lang, next: string, error = "", status = 200) {
  const t = copy[lang];
  const nonce = randomBytes(18).toString("base64");
  const links = (["ru", "kk", "en"] as const).map(l => `<a href="?lang=${l}&amp;next=${encodeURIComponent(next)}" lang="${l}"${l === lang ? ' aria-current="page"' : ""}>${l.toUpperCase()}</a>`).join(" ");
  return new Response(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t.title} · Urbanmag</title><style nonce="${nonce}">@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:swap;src:url('/fonts/inter-cyrillic-ext-wght-normal.woff2') format('woff2');unicode-range:U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F}@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:swap;src:url('/fonts/inter-cyrillic-wght-normal.woff2') format('woff2');unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116}@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:swap;src:url('/fonts/inter-latin-wght-normal.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:#fff;color:#000;font-family:Inter,Arial,sans-serif;padding:24px}main{width:min(100%,440px)}nav{display:flex;gap:12px;margin-bottom:36px}a{color:inherit;min-width:44px;min-height:44px;display:grid;place-items:center;border-radius:24px;text-decoration:none;border:1px solid rgb(0 0 0 / 14%)}a[aria-current]{background:#000;color:#fff}h1{font-size:32px;line-height:1.1}p{line-height:1.6}label{display:block;margin:24px 0 8px}input,button{width:100%;min-height:48px;border:1px solid rgb(0 0 0 / 35%);border-radius:24px;padding:12px 18px;font:inherit}button{margin-top:16px;background:#E60012;border-color:#E60012;color:#fff;font-weight:600;cursor:pointer}:focus-visible{outline:3px solid #E60012;outline-offset:4px}.error{color:#E60012}</style></head><body><main><nav aria-label="Language">${links}</nav><p>URBANMAG / DEV</p><h1>${t.title}</h1><p>${t.description}</p>${error ? `<p role="alert" class="error">${escape(error)}</p>` : ""}<form method="post" action="/api/dev-access/login?lang=${lang}"><input type="hidden" name="next" value="${escape(next)}"><label for="password">${t.password}</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="1024" autofocus><button type="submit">${t.submit}</button></form></main></body></html>`, { status, headers: { ...privateHeaders, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": `default-src 'none'; style-src 'nonce-${nonce}'; font-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'` } });
}
function nextFromUrl(request: NextRequest) {
  // Nginx appends the original URI unchanged, including its query parameters.
  const raw = request.nextUrl.search.match(/[?&]next=(.*)$/)?.[1] || "/";
  try { return safeDevNext(raw.startsWith("/") ? raw : decodeURIComponent(raw)); } catch { return "/"; }
}
export async function GET(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (action === "check") return new Response(null, { status: !devAccessEnabled() ? (process.env.APP_ENV === "production" ? 204 : 401) : validDevAccessToken(request.cookies.get(devCookieName)?.value, request.headers.get("host") || "") ? 204 : 401, headers: privateHeaders });
  if (action !== "login" || process.env.APP_ENV === "production" || !devAccessEnabled()) return new Response(null, { status: 404, headers: privateHeaders });
  const lang = language(request);
  if (!devAccessConfigured()) return page(lang, "/", copy[lang].unavailable, 503);
  return page(lang, nextFromUrl(request));
}
export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  if ((await context.params).action !== "login" || process.env.APP_ENV === "production" || !devAccessEnabled()) return new Response(null, { status: 404, headers: privateHeaders });
  const lang = language(request), t = copy[lang];
  if (!devAccessConfigured()) return page(lang, "/", t.unavailable, 503);
  const host = request.headers.get("host") || "";
  if (request.headers.get("origin") !== `https://${host}` || request.headers.get("sec-fetch-site") === "cross-site") return page(lang, "/", t.denied, 403);
  if (!allowDevLogin(request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "unknown")) { const response = page(lang, "/", t.limited, 429); response.headers.set("Retry-After", "60"); return response; }
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded") || Number(request.headers.get("content-length") || 0) > 8192) return page(lang, "/", t.denied, 400);
  const raw = await request.text();
  if (raw.length > 8192) return page(lang, "/", t.denied, 400);
  const form = new URLSearchParams(raw), next = safeDevNext(form.get("next")), password = form.get("password") || "";
  let valid = false;
  if (password.length > 0 && password.length <= 1024) try { valid = await verify(process.env.DEV_ACCESS_PASSWORD_HASH!, password); } catch { return page(lang, next, t.unavailable, 503); }
  if (!valid) return page(lang, next, t.error, 401);
  return new Response(null, { status: 303, headers: { ...privateHeaders, Location: next, "Set-Cookie": `${devCookieName}=${createDevAccessToken(host)}; Path=/; Max-Age=${devAccessLifetime}; Secure; HttpOnly; SameSite=Lax` } });
}

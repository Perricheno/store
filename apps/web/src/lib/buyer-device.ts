import type { Product } from "@urbanmag/core";

export const HISTORY_KEY = "urbanmag:history:v1";
export const HISTORY_DAYS = 30;
export const HISTORY_LIMIT = 24;
export type ViewedProduct = { slug: string; category: string; viewedAt: number };
export type ViewHistory = { enabled: boolean; entries: ViewedProduct[] };
export const emptyHistory = (): ViewHistory => ({ enabled: true, entries: [] });
export function parseHistory(raw: string | null, now = Date.now()): ViewHistory {
  try {
    const value = JSON.parse(raw || "null");
    if (!value || typeof value.enabled !== "boolean") return emptyHistory();
    if (!value.enabled) return { enabled: false, entries: [] };
    const seen = new Set<string>();
    const entries = (Array.isArray(value.entries) ? value.entries : [])
      .filter((entry: unknown): entry is ViewedProduct => {
        if (!entry || typeof entry !== "object") return false;
        const item = entry as ViewedProduct;
        return typeof item.slug === "string" && /^[a-z0-9][a-z0-9-]{0,199}$/.test(item.slug)
          && typeof item.category === "string" && /^[a-z0-9-]{1,100}$/.test(item.category)
          && typeof item.viewedAt === "number" && Number.isFinite(item.viewedAt)
          && item.viewedAt <= now && item.viewedAt > now - HISTORY_DAYS * 86400000;
      })
      .sort((a: ViewedProduct, b: ViewedProduct) => b.viewedAt - a.viewedAt)
      .filter((entry: ViewedProduct) => !seen.has(entry.slug) && !!seen.add(entry.slug))
      .slice(0, HISTORY_LIMIT);
    return { enabled: true, entries };
  } catch { return emptyHistory(); }
}
export function recordView(history: ViewHistory, product: Pick<Product, "slug" | "category">, now = Date.now()): ViewHistory {
  if (!history.enabled) return { enabled: false, entries: [] };
  return parseHistory(JSON.stringify({ enabled: true, entries: [
    { slug: product.slug, category: product.category, viewedAt: now },
    ...history.entries.filter((entry) => entry.slug !== product.slug),
  ] }), now);
}
export function rankSuggestions(products: Product[], history: ViewedProduct[], favorites: Product[], limit = 6): Product[] {
  const scores = new Map<string, number>();
  for (const item of history) scores.set(item.category, (scores.get(item.category) || 0) + 1);
  for (const item of favorites) scores.set(item.category, (scores.get(item.category) || 0) + 2);
  const excluded = new Set([...history.map((item) => item.slug), ...favorites.map((item) => item.slug)]);
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id) || !product.published || excluded.has(product.slug) || !scores.has(product.category)
      || !product.sizes.some((size) => size.available > 0)) return false;
    seen.add(product.id); return true;
  }).sort((a, b) => (scores.get(b.category) || 0) - (scores.get(a.category) || 0) || a.slug.localeCompare(b.slug)).slice(0, limit);
}
export function orderFingerprint(order: { status: string; paymentStatus?: string }): string {
  return `${order.status}:${order.paymentStatus || ""}`;
}
export function parseReadMarkers(raw: string | null): Record<string, string> {
  try {
    const value = JSON.parse(raw || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => {
      const [id, fingerprint] = entry;
      return /^[a-z0-9-]{1,128}$/i.test(id) && typeof fingerprint === "string" && fingerprint.length < 200;
    }).slice(-200));
  } catch { return {}; }
}
export function findOwnOrder<T extends { id: string; number?: string }>(orders: T[], query: string): T | undefined {
  const input = query.trim().replace(/^#/, "").toLowerCase();
  if (!input) return undefined;
  // Resolve only against the authenticated account response, never an arbitrary order lookup.
  const matches = orders.filter((order) => order.id.toLowerCase() === input || (order.number || order.id.slice(0, 8)).toLowerCase() === input);
  return matches.length === 1 ? matches[0] : undefined;
}

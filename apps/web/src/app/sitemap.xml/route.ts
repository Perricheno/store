import { getProducts } from "@urbanmag/core";
import { indexingEnabled, locales, shopOrigin } from "@/lib/config";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!indexingEnabled()) return new Response("Not found", { status: 404 });
  const products = (await getProducts()).filter((p) => !p.isDemo);
  const origin = shopOrigin();
  const paths = [
    "",
    ...products.map((p) => `/p/${p.slug}`),
    ...[...new Set(products.map((p) => p.category))].map((c) => `/c/${c}`),
  ];
  const urls = paths
    .flatMap((path) =>
      locales.map(
        (locale) =>
          `<url><loc>${origin}/${locale}${path}</loc>${locales.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${origin}/${l}${path}"/>`).join("")}</url>`,
      ),
    )
    .join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}

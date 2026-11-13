import { categoryName } from "./categories";
import type { Metadata } from "next";
import { indexingEnabled, locales, shopOrigin, type Locale } from "./config";
export function pageMetadata(
  locale: Locale,
  title: string,
  description: string,
  suffix = "",
): Metadata {
  const origin = shopOrigin();
  return {
    title,
    description,
    metadataBase: new URL(origin),
    alternates: {
      canonical: `${origin}/${locale}${suffix}`,
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${origin}/${l}${suffix}`]),
        ["x-default", `${origin}/ru${suffix}`],
      ]),
    },
    robots: { index: indexingEnabled(), follow: true },
    openGraph: {
      title: `${title} — Urbanmag`,
      description,
      url: `${origin}/${locale}${suffix}`,
      type: "website",
      siteName: "Urbanmag",
      locale,
    },
  };
}
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function categoryMetadata(locale: Locale, slug: string) {
  const name = categoryName(locale, slug) || slug;
  const description = {
    ru: `${name} в каталоге Urbanmag. Самовывоз в Жезказгане.`,
    kk: `Urbanmag каталогындағы ${name}. Жезқазғанда алып кету.`,
    en: `${name} in the Urbanmag catalog. Pickup in Zhezkazgan.`,
  }[locale];
  return pageMetadata(locale, name, description, `/c/${slug}`);
}

import { notFound } from "next/navigation";
import { cache } from "react";
import { getProduct, getSettings } from "@urbanmag/core";
import { ProductDetail } from "@/components/shop";
import { isLocale, shopOrigin } from "@/lib/config";
import { JsonLd, pageMetadata } from "@/lib/seo";
const productBySlug = cache(getProduct);
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const product = await productBySlug(slug);
  if (!product) return {};
  return pageMetadata(
    locale,
    product.names[locale],
    product.description[locale],
    `/p/${product.slug}`,
  );
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const product = await productBySlug(slug);
  if (!product || !product.published) notFound();
  const settings = await getSettings();
  const origin = shopOrigin();
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.names[locale],
    description: product.description[locale],
    sku: product.id,
    ...(product.media.length
      ? { image: product.media.map((p) => new URL(p, origin).href) }
      : {}),
    brand: { "@type": "Brand", name: product.brand },
    offers: {
      "@type": "Offer",
      priceCurrency: "KZT",
      price: product.price,
      availability: product.sizes.some((s) => s.available > 0)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${origin}/${locale}/p/${product.slug}`,
    },
  };
  return (
    <>
      {!product.isDemo && <JsonLd data={data} />}
      <ProductDetail locale={locale} product={product} settings={settings} />
    </>
  );
}

import { notFound } from "next/navigation";
import { getCatalogPage, getSettings } from "@urbanmag/core";
import { Storefront } from "@/components/shop-storefront";
import { isLocale } from "@/lib/config";
import { categoryMetadata } from "@/lib/seo";
import { initialCart } from "@/lib/server-cart";
import { publicCatalog } from "@/lib/public-catalog";
import {
  CATALOG_PAGE_SIZE,
  categoryName,
  catalogFiltersFromSearch,
  catalogCoreFilters,
  type CatalogSearchParams,
} from "@/lib/categories";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  return categoryMetadata(locale, slug);
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<CatalogSearchParams>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !categoryName(locale, slug)) notFound();
  const filters = catalogFiltersFromSearch(await searchParams, slug);
  const [rawCatalog, settings, cart] = await Promise.all([
    getCatalogPage({
      ...catalogCoreFilters(filters),
      page: 1,
      pageSize: CATALOG_PAGE_SIZE,
    }),
    getSettings(),
    initialCart(),
  ]);
  const catalog = publicCatalog(rawCatalog);
  return (
    <Storefront
      locale={locale}
      products={catalog.products}
      initialPagination={catalog}
      initialFilters={filters}
      initialCategory={slug}
      settings={settings}
      initialCart={cart}
    />
  );
}

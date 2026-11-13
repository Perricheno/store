import { notFound } from "next/navigation";
import { getCatalogPage } from "@urbanmag/core";
import { shopSettings as getSettings } from "@/lib/server-settings";
import { Storefront } from "@/components/shop-storefront";
import { isLocale } from "@/lib/config";
import { pageMetadata } from "@/lib/seo";
import { initialCart } from "@/lib/server-cart";
import { publicCatalog } from "@/lib/public-catalog";
import {
  CATALOG_PAGE_SIZE,
  catalogFiltersFromSearch,
  catalogCoreFilters,
  type CatalogSearchParams,
} from "@/lib/categories";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const titles = {
    ru: "Одежда и кроссовки",
    kk: "Киім және кроссовкалар",
    en: "Clothing & sneakers",
  };
  const descriptions = {
    ru: "Каталог Urbanmag. Одежда и кроссовки, самовывоз в Жезказгане.",
    kk: "Urbanmag каталогы. Киім мен кроссовкалар, Жезқазғанда алып кету.",
    en: "The Urbanmag catalog. Clothing and sneakers, pickup in Zhezkazgan.",
  };
  return pageMetadata(locale, titles[locale], descriptions[locale]);
}
export default async function Catalog({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CatalogSearchParams>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const filters = catalogFiltersFromSearch(await searchParams);
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
      settings={settings}
      initialCart={cart}
    />
  );
}

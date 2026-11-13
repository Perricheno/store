import { CATEGORIES } from "@urbanmag/core/categories";
import type { Locale } from "./i18n";

export { CATEGORIES };
export const CATALOG_PAGE_SIZE = 24;
export type CatalogFilterState = {
  category: string;
  gender: string;
  q: string;
  sort: string;
  size: string;
  minPrice: string;
  maxPrice: string;
  available: boolean;
};
export type CatalogSearchParams = Record<string, string | string[] | undefined>;
export function categoryName(locale: Locale, slug: string): string | undefined {
  return CATEGORIES.find((category) => category.id === slug)?.names[locale];
}
export function catalogFiltersFromSearch(
  search: CatalogSearchParams,
  category = "all",
): CatalogFilterState {
  const value = (key: string) => {
    const raw = search[key];
    return Array.isArray(raw) ? raw[0] || "" : raw || "";
  };
  const price = (key: string) => {
    const raw = value(key);
    return raw && Number.isFinite(Number(raw)) && Number(raw) >= 0 ? raw : "";
  };
  const requestedCategory = value("category");
  return {
    category:
      category !== "all"
        ? category
        : CATEGORIES.some((c) => c.id === requestedCategory)
          ? requestedCategory
          : "all",
    gender: ["men", "women"].includes(value("gender")) ? value("gender") : "",
    q: value("q").trim().slice(0, 200),
    sort: ["price-asc", "price-desc"].includes(value("sort"))
      ? value("sort")
      : "newest",
    size: value("size").slice(0, 32),
    minPrice: price("minPrice"),
    maxPrice: price("maxPrice"),
    available: value("available") === "true",
  };
}
export function catalogQuery(filters: CatalogFilterState): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ["gender", "q", "size", "minPrice", "maxPrice"] as const)
    if (filters[key]) params.set(key, filters[key]);
  if (filters.category !== "all") params.set("category", filters.category);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.available) params.set("available", "true");
  return params;
}
export function catalogCoreFilters(filters: CatalogFilterState) {
  return {
    category: filters.category === "all" ? undefined : filters.category,
    gender: filters.gender || undefined,
    q: filters.q || undefined,
    sort: filters.sort,
    size: filters.size || undefined,
    minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
    maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
    available: filters.available,
  };
}

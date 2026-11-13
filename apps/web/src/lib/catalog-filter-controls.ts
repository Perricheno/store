import {
  catalogFiltersFromSearch,
  catalogQuery,
  type CatalogFilterState,
} from "./categories";
import type { Locale } from "./i18n";

/** Price bounds form one refinement, including a zero-valued bound. */
export function catalogRefinementCount(filters: CatalogFilterState): number {
  return [
    filters.category !== "all",
    Boolean(filters.gender),
    Boolean(filters.size),
    filters.minPrice !== "" || filters.maxPrice !== "",
    filters.available,
  ].filter(Boolean).length;
}

/** Clearing refinements keeps the shopper's search and chosen ordering. */
export function clearCatalogRefinements(
  filters: CatalogFilterState,
): CatalogFilterState {
  return {
    ...filters,
    category: "all",
    gender: "",
    size: "",
    minPrice: "",
    maxPrice: "",
    available: false,
  };
}

export function validCatalogPriceRange(filters: CatalogFilterState): boolean {
  const valid = (value: string) =>
    value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0);
  return (
    valid(filters.minPrice) &&
    valid(filters.maxPrice) &&
    (filters.minPrice === "" ||
      filters.maxPrice === "" ||
      Number(filters.minPrice) <= Number(filters.maxPrice))
  );
}

export function catalogLocation(
  locale: Locale,
  filters: CatalogFilterState,
  initialCategory = "all",
): string {
  const params = catalogQuery(filters);
  const categoryRoute =
    initialCategory !== "all" && filters.category === initialCategory;
  if (categoryRoute) params.delete("category");
  const search = params.toString();
  return `/${locale}${categoryRoute ? `/c/${initialCategory}` : ""}${search ? `?${search}` : ""}`;
}

export function catalogFiltersFromLocation(
  pathname: string,
  search: string,
): CatalogFilterState {
  const match = pathname.match(/^\/(?:ru|kk|en)\/c\/([^/]+)\/?$/);
  return catalogFiltersFromSearch(
    Object.fromEntries(new URLSearchParams(search)),
    match?.[1] || "all",
  );
}

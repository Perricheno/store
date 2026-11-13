import assert from "node:assert/strict";
import test from "node:test";
import { catalogFiltersFromSearch } from "../apps/web/src/lib/categories";
import {
  catalogFiltersFromLocation,
  catalogLocation,
  catalogRefinementCount,
  clearCatalogRefinements,
  validCatalogPriceRange,
} from "../apps/web/src/lib/catalog-filter-controls";

test("refinements count groups and preserve search and sort when cleared", () => {
  const filters = catalogFiltersFromSearch({
    category: "sneakers", gender: "women", size: "38", minPrice: "0",
    maxPrice: "20000", available: "true", q: "City", sort: "price-asc",
  });
  assert.equal(catalogRefinementCount(filters), 5);
  assert.deepEqual(clearCatalogRefinements(filters), {
    category: "all", gender: "", size: "", minPrice: "", maxPrice: "",
    available: false, q: "City", sort: "price-asc",
  });
  assert.equal(catalogRefinementCount(clearCatalogRefinements(filters)), 0);
  assert.equal(filters.category, "sneakers");
});

test("price bounds accept zero/open/equal ranges and reject invalid ranges", () => {
  const base = catalogFiltersFromSearch({});
  for (const [minPrice, maxPrice] of [["", ""], ["0", "0"], ["", "5"], ["100", ""], ["10.5", "10.5"]])
    assert.equal(validCatalogPriceRange({ ...base, minPrice, maxPrice }), true);
  for (const [minPrice, maxPrice] of [["100", "10"], ["-1", ""], ["", "-1"], ["Infinity", ""], ["oops", "10"]])
    assert.equal(validCatalogPriceRange({ ...base, minPrice, maxPrice }), false);
});

test("category route, search, sort and refinements survive URL/back round trips", () => {
  const filters = catalogFiltersFromSearch({
    category: "sneakers", q: "City + sport", sort: "price-desc", size: "38",
    minPrice: "0", maxPrice: "20000", available: "true", gender: "women",
  });
  for (const initialCategory of ["all", "sneakers", "socks"]) {
    const path = catalogLocation("kk", filters, initialCategory);
    const url = new URL(path, "https://urbanmag.test");
    assert.deepEqual(catalogFiltersFromLocation(url.pathname, url.search), filters);
    assert.equal(url.searchParams.has("page"), false);
    if (initialCategory === "sneakers") {
      assert.equal(url.pathname, "/kk/c/sneakers");
      assert.equal(url.searchParams.has("category"), false);
    } else assert.equal(url.pathname, "/kk");
  }
  const reset = clearCatalogRefinements(filters);
  assert.equal(catalogLocation("ru", reset, "sneakers"), "/ru?q=City+%2B+sport&sort=price-desc");
});

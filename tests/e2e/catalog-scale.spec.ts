import { test, expect } from "@playwright/test";
import { CATEGORIES } from "@urbanmag/core/categories";

test("500-piece catalog renders one bounded page and appends without duplicates", async ({
  page,
  request,
}) => {
  const response = await request.get("/ru");
  expect(response.ok()).toBeTruthy();
  expect((await response.text()).match(/<article\b/g)).toHaveLength(24);
  const first = await (
    await request.get("/api/products?page=1&pageSize=24")
  ).json();
  expect(first.total).toBeGreaterThanOrEqual(500);
  expect(first.products).toHaveLength(24);
  expect(first.hasMore).toBe(true);
  expect((await request.get("/api/products?pageSize=1000")).status()).toBe(400);
  const bounded = await (await request.get("/api/products?pageSize=60")).json();
  expect(bounded.products).toHaveLength(60);
  const initialCatalogRequests: string[] = [];
  const routePrefetches: string[] = [];
  page.on("request", request => {
    const url=new URL(request.url());
    if(url.pathname==="/api/products")initialCatalogRequests.push(url.href);
    if(url.searchParams.has("_rsc"))routePrefetches.push(url.href);
  });
  await page.goto("/ru");
  const cards = page.getByTestId("catalog-grid").locator("article");
  await expect(cards).toHaveCount(24);
  await expect(page.getByRole("button", { name: "Показать ещё", exact: true })).toBeEnabled();
  expect(initialCatalogRequests).toEqual([]);
  const next = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/api/products" && url.searchParams.get("page") === "2"
    );
  });
  await page.getByRole("button", { name: "Показать ещё", exact: true }).click();
  expect((await next).ok()).toBeTruthy();
  await expect(cards).toHaveCount(48);
  const hrefs = await cards.evaluateAll((cards) =>
    cards.map((card) =>
      card.querySelector('a[href*="/p/"]')?.getAttribute("href"),
    ),
  );
  expect(new Set(hrefs).size).toBe(48);
  // Warm only the small main navigation; product pages must not flood prefetch.
  const prefetched = routePrefetches.map(value => new URL(value));
  expect(prefetched.filter(url => !["/ru", "/ru/cart", "/ru/account", "/ru/favorites"].includes(url.pathname)).map(url => url.pathname)).toEqual([]);
  expect(new Set(prefetched.map(url => url.pathname + (url.searchParams.get("gender") || ""))).size).toBeLessThanOrEqual(6);
  await expect(page.getByRole("status")).toContainText(`48 из ${first.total}`);
});

test("changing category cancels a pending page and resets pagination", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  page.once("close", release);
  await page.route("**/api/products?**", async (route) => {
    const url = new URL(route.request().url());
    if (
      url.searchParams.get("page") !== "2" ||
      url.searchParams.has("category")
    )
      return route.continue();
    const response = await route.fetch();
    await pending;
    try {
      await route.fulfill({ response });
    } catch {
      /* The filter change intentionally aborts this request. */
    }
  });
  await page.goto("/ru");
  const cards = page.getByTestId("catalog-grid").locator("article");
  await expect(cards).toHaveCount(24);
  const loadMore = page.getByRole("button", { name: "Показать ещё", exact: true });
  await expect(loadMore).toBeEnabled();
  await Promise.all([
    page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.pathname === "/api/products" && url.searchParams.get("page") === "2" && !url.searchParams.has("category");
    }, {timeout: 15000}),
    loadMore.click(),
  ]);
  const filtered = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/api/products" &&
      url.searchParams.get("category") === "socks" &&
      url.searchParams.get("page") === "1"
    );
  });
  await page
    .getByRole("navigation", { name: "Категории", exact: true })
    .getByRole("button", { name: "Носки", exact: true })
    .click();
  const current = await (await filtered).json();
  release();
  await expect(page).toHaveURL(/category=socks/);
  await expect(cards).toHaveCount(current.products.length);
  const finished = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === "/api/products" &&
      url.searchParams.get("category") === "socks" &&
      url.searchParams.get("page") === "2"
    );
  });
  await page.getByRole("button", { name: "Показать ещё", exact: true }).click();
  expect((await finished).ok()).toBeTruthy();
  await expect(cards).toHaveCount(current.total);
  const expected = await page.request
    .get("/api/products?category=socks&pageSize=60")
    .then((response) => response.json());
  const hrefs = await cards.evaluateAll((cards) =>
    cards.map((card) =>
      card.querySelector('a[href*="/p/"]')?.getAttribute("href"),
    ),
  );
  expect(hrefs).toEqual(
    expected.products.map(
      (product: { slug: string }) => `/ru/p/${product.slug}`,
    ),
  );
});

test("broad categories have icons and long localized headings fit mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const locale of ["ru", "kk", "en"] as const) {
    await page.goto(`/${locale}/c/basketball-shoes?sort=price-asc`);
    const category = CATEGORIES.find(
      (category) => category.id === "basketball-shoes",
    )!;
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      category.names[locale],
    );
    await expect(page).toHaveURL(
      new RegExp(`/${locale}/c/basketball-shoes\\?sort=price-asc`),
    );
    const nav = page.getByRole("navigation", {
      name: { ru: "Категории", kk: "Санаттар", en: "Categories" }[locale],
      exact: true,
    });
    await expect(nav.getByRole("button")).toHaveCount(CATEGORIES.length + 1);
    await expect(nav.locator("button svg")).toHaveCount(CATEGORIES.length + 1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(360);
    await expect(
      page.getByTestId("catalog-grid").locator("article"),
    ).toHaveCount(24);
  }
});

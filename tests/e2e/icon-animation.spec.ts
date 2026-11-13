import { expect, test } from "@playwright/test";

test("fallback icon gleam pauses outside the viewport and resumes when scrolled into view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/ru");
  const icons = page
    .getByTestId("catalog-grid")
    .locator("div[data-gleam-visible]");
  await expect(icons.first()).toBeVisible();
  expect(await icons.count()).toBeGreaterThan(2);
  const offscreen = icons.last();
  const gleam = offscreen.locator('span[class*="gleam"]');
  await expect(offscreen).toHaveAttribute("data-gleam-visible", "false");
  await expect(gleam).toHaveCSS("animation-play-state", "paused");
  await offscreen.scrollIntoViewIfNeeded();
  await expect(offscreen).toHaveAttribute("data-gleam-visible", "true");
  await expect(gleam).toHaveCSS("animation-play-state", "running");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(gleam).toHaveCSS("animation-play-state", "paused");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await offscreen.scrollIntoViewIfNeeded();
  await expect(gleam).toHaveCSS("animation-name", "none");
  await expect(offscreen).toBeVisible();
});

test("a loaded product photo stops the covered fallback animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.route("**/api/products**", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const products = Array.isArray(data) ? data : data.products;
    products[0].media = ["/test-category-photo.svg"];
    await route.fulfill({ response, json: data });
  });
  await page.route("**/test-category-photo.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>',
    }),
  );
  await page.goto("/ru");
  await expect(
    page.getByRole("button", { name: "Показать ещё", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("combobox", { name: "Сортировка", exact: true })
    .selectOption("price-asc");
  const card = page
    .locator("article")
    .filter({ has: page.locator('img[src="/test-category-photo.svg"]') });
  await expect(card.locator("img")).toBeVisible();
  const fallback = card.locator("div[data-gleam-visible]");
  await expect(fallback).toHaveAttribute("data-photo-loaded", "true");
  await expect(fallback).toHaveAttribute("data-gleam-visible", "false");
  await expect(fallback).toBeHidden();
  await expect(fallback.locator('span[class*="gleam"]')).toHaveCSS(
    "animation-play-state",
    "paused",
  );
});

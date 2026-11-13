import { expect, test } from "@playwright/test";
import { CATEGORIES } from "@urbanmag/core/categories";

for (const width of [360, 390, 768, 1440]) {
  test(`catalog layout and navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/ru");
    const nav = page.locator('nav[class*="bottomNav"]');
    if (width < 768) {
      await expect(nav).toBeVisible();
      await expect(nav.getByRole("link")).toHaveCount(4);
      for (const [name, path] of [
        ["Избранное", "/ru/favorites"],
        ["Корзина", "/ru/cart"],
        ["Личный кабинет", "/ru/account"],
        ["Каталог", "/ru"],
      ]) {
        const link = nav.getByRole("link", { name, exact: true });
        await expect(link).toHaveAttribute("href", path);
        const box = await link.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        await link.click();
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        await expect(link).toHaveAttribute("aria-current", "page");
      }
      const heading = await page
        .getByRole("heading", { level: 1 })
        .boundingBox();
      expect(heading!.height).toBeLessThanOrEqual(90);
    } else {
      await expect(nav).toBeHidden();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  });
}

test("mobile navigation preserves each locale and language selector preserves filters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  for (const locale of ["ru", "kk", "en"] as const) {
    await page.goto(`/${locale}`);
    const nav = page.locator('nav[class*="bottomNav"]');
    for (const [index, suffix] of [
      "",
      "/favorites",
      "/cart",
      "/account",
    ].entries()) {
      const link = nav.getByRole("link").nth(index);
      await expect(link).toHaveAttribute("href", `/${locale}${suffix}`);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/${locale}${suffix}$`));
      await expect(link).toHaveAttribute("aria-current", "page");
    }
  }
  await page.goto("/ru?gender=women");
  const language = page.getByRole("combobox", { name: "Язык", exact: true });
  await expect(language).toBeVisible();
  const box = await language.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await language.selectOption("kk");
  await expect(page).toHaveURL(/\/kk\?gender=women$/);
});

test("category buttons have icons and a hidden but keyboard-scrollable rail", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/ru");
  const rail = page.getByRole("navigation", { name: "Категории", exact: true });
  const buttons = rail.getByRole("button");
  await expect(buttons).toHaveCount(CATEGORIES.length + 1);
  for (const button of await buttons.all()) {
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    const icon = await button.locator("svg").boundingBox();
    expect(icon!.width).toBeGreaterThan(0);
    expect(icon!.height).toBeGreaterThan(0);
  }
  const style = await rail.evaluate((el) => ({
    overflow: getComputedStyle(el).overflowX,
    scrollbar: getComputedStyle(el).scrollbarWidth,
    webkit: getComputedStyle(el, "::-webkit-scrollbar").display,
    width: el.scrollWidth,
    client: el.clientWidth,
  }));
  expect(style.overflow).toMatch(/auto|scroll/);
  expect(style.scrollbar === "none" || style.webkit === "none").toBe(true);
  expect(style.width).toBeGreaterThan(style.client);
  await buttons.first().focus();
  for (let i = 1; i < CATEGORIES.length + 1; i++)
    await page.keyboard.press("Tab");
  await expect(buttons.last()).toBeFocused();
  expect(await rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
});

test("filter panel hides its scrollbar while allowing keyboard scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 320 });
  await page.goto("/ru");
  await page.getByRole("button", { name: "Фильтры" }).click();
  const dialog = page.getByRole("dialog", { name: "Фильтры" });
  await expect(dialog).toBeVisible();
  const style = await dialog.evaluate((el) => ({
    overflow: getComputedStyle(el).overflowY,
    scrollbar: getComputedStyle(el).scrollbarWidth,
    webkit: getComputedStyle(el, "::-webkit-scrollbar").display,
    height: el.scrollHeight,
    client: el.clientHeight,
  }));
  expect(style.overflow).toMatch(/auto|scroll/);
  expect(style.scrollbar === "none" || style.webkit === "none").toBe(true);
  expect(style.height).toBeGreaterThan(style.client);
  await dialog.getByRole("button").first().focus();
  const reset = dialog.getByRole("button", { name: "Сбросить" });
  for (
    let i = 0;
    i < 30 && !(await reset.evaluate((el) => el === document.activeElement));
    i++
  ) {
    await page.keyboard.press("Tab");
  }
  await expect(reset).toBeFocused();
  expect(await dialog.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});

test("missing product photos use a large masked category icon", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/ru/p/city-tee");
  const icon = page.locator('article svg[role="img"]').first();
  await expect(icon).toBeVisible();
  const box = await icon.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(80);
  expect(box!.height).toBeGreaterThanOrEqual(80);
  await expect(icon.locator('g[mask] rect[class*="gleam"]')).toBeVisible();
});

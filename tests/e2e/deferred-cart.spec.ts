import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Product } from "@urbanmag/core";
import { dictionary, type Locale } from "../../apps/web/src/lib/i18n";

const origin = { Origin: "https://localhost:3443" };
async function cityProduct(page: Page) {
  const response = await page.request.get("/api/products?q=City");
  expect(response.ok()).toBeTruthy();
  const product = ((await response.json()) as { products: Product[] }).products.find(
    (item) => item.slug === "city-tee",
  )!;
  expect(product).toBeDefined();
  expect(product.sizes.filter((variant) => variant.available >= 2).length).toBeGreaterThan(1);
  return product;
}
function cartWrite(page: Page, method: "POST" | "PATCH") {
  return page.waitForResponse((response) => response.url().endsWith("/api/cart") && response.request().method() === method);
}

for (const [locale, chooseSize] of [
  ["ru", "Выберите размер"], ["kk", "Өлшемді таңдаңыз"], ["en", "Choose a size"],
] as const satisfies readonly (readonly [Locale, string])[]) {
  test(`${locale}: quick add defers size to the cart, persists after reload and gates checkout`, async ({ page }) => {
    const t = dictionary(locale);
    const product = await cityProduct(page);
    await page.goto(`/${locale}?q=City`);
    const saved = cartWrite(page, "POST");
    await page.getByRole("button", { name: `${t.addCart}: ${product.names[locale]}`, exact: true }).click();
    expect((await saved).ok()).toBeTruthy();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const persisted = await (await page.request.get("/api/cart")).json();
    expect(persisted.items).toHaveLength(1);
    expect(persisted.items[0].variantId).toBeNull();
    expect(persisted.items[0].quantity).toBe(1);

    await page.goto(`/${locale}/cart`);
    const row = page.getByRole("article");
    await expect(row.getByText(chooseSize, { exact: true }).first()).toBeVisible();
    await expect(row.locator('span[aria-hidden="true"]').filter({ hasText: "!" })).toHaveCSS("background-color", "rgb(245, 203, 54)");
    const size = row.getByRole("combobox");
    await expect(size).toHaveValue("");
    await expect(page.getByRole("button", { name: t.checkout, exact: true })).toBeDisabled();
    await page.reload();
    await expect(size).toHaveValue("");
    await expect(row.getByText(product.names[locale], { exact: true })).toBeVisible();

    // Direct navigation and direct API calls must enforce the same requirement.
    await page.goto(`/${locale}/checkout`);
    await expect(page.getByRole("link", { name: chooseSize, exact: true })).toHaveAttribute("href", `/${locale}/cart`);
    await expect(page.getByRole("button", { name: t.placeOrder, exact: true })).toBeDisabled();
    const rejected = await page.request.post("/api/checkout", {
      headers: origin,
      data: { email: "deferred@example.test", phone: "+77011234567", fulfillment: "pickup", expectedTotal: persisted.total, idempotencyKey: randomUUID(), locale },
    });
    expect(rejected.status()).toBe(409);
    expect((await rejected.json()).code).toBe("SIZE_REQUIRED");

    await page.goto(`/${locale}/cart`);
    const selected = cartWrite(page, "PATCH");
    await size.selectOption(product.sizes.find((variant) => variant.available > 0)!.id);
    expect((await selected).ok()).toBeTruthy();
    await expect(row.getByText(chooseSize, { exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: t.checkout, exact: true }).click();
    await expect(page.getByRole("button", { name: t.placeOrder, exact: true })).toBeEnabled();
  });
}

test("failed size selection preserves both lines; retry and later size change merge real variants", async ({ page }) => {
  const product = await cityProduct(page);
  const variants = product.sizes.filter((variant) => variant.available >= 2);
  for (const data of [{ variantId: variants[0].id, quantity: 1 }, { productId: product.id, quantity: 1 }]) {
    expect((await page.request.post("/api/cart", { headers: origin, data })).ok()).toBeTruthy();
  }
  await page.goto("/ru/cart");
  await expect(page.getByRole("article")).toHaveCount(2);
  const pending = page.getByRole("article").filter({ hasText: "Выберите размер" }).getByRole("combobox");
  await page.route("**/api/cart", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    await route.fulfill({ status: 409, json: { code: "OUT_OF_STOCK", error: "Stock changed" } });
  });
  const failed = cartWrite(page, "PATCH");
  await pending.selectOption(variants[0].id);
  expect((await failed).status()).toBe(409);
  const cartError = page.getByRole("main").getByRole("alert");
  await expect(cartError).toHaveText("Не удалось обновить корзину.");
  await expect(cartError).toBeVisible();
  await expect(pending).toHaveValue("");
  expect((await (await page.request.get("/api/cart")).json()).items).toHaveLength(2);
  await page.unroute("**/api/cart");

  const merged = cartWrite(page, "PATCH");
  await pending.selectOption(variants[0].id);
  expect((await merged).ok()).toBeTruthy();
  await expect(page.getByRole("article")).toHaveCount(1);
  let current = await (await page.request.get("/api/cart")).json();
  expect(current.items[0].variantId).toBe(variants[0].id);
  expect(current.items[0].quantity).toBe(2);
  const changed = cartWrite(page, "PATCH");
  await page.getByRole("article").getByRole("combobox").selectOption(variants[1].id);
  expect((await changed).ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByRole("article").getByRole("combobox")).toHaveValue(variants[1].id);
  current = await (await page.request.get("/api/cart")).json();
  expect(current.items).toHaveLength(1);
  expect(current.items[0].quantity).toBe(2);
  expect(current.items[0].variantId).toBe(variants[1].id);
});

for (const source of ["favorites", "history"] as const) {
  test(`${source} cards use the same immediate add with size deferred`, async ({ page }) => {
    const product = await cityProduct(page);
    if (source === "favorites") {
      expect((await page.request.post("/api/favorites", { headers: origin, data: { productId: product.id } })).ok()).toBeTruthy();
      await page.goto("/ru/favorites");
    } else {
      await page.goto(`/ru/p/${product.slug}`);
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("urbanmag:history:v1") || "{}").entries?.length)).toBe(1);
      await page.goto("/ru/account");
    }
    const area = source === "history" ? page.locator('section[aria-labelledby="recent-heading"]') : page.locator("main");
    const saved = cartWrite(page, "POST");
    await area.getByRole("button", { name: `Добавить в корзину: ${product.names.ru}`, exact: true }).click();
    expect((await saved).ok()).toBeTruthy();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const cart = await (await page.request.get("/api/cart")).json();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].product.id).toBe(product.id);
    expect(cart.items[0].variantId).toBeNull();
    expect(cart.count).toBe(1);
  });
}

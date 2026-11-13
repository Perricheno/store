import { test, expect } from "@playwright/test";
import type { Product } from "@urbanmag/core";

test("device history persists, can be cleared, and honors the off switch", async ({ page }) => {
  await page.goto("/ru/p/city-tee");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("urbanmag:history:v1") || "{}").entries?.length)).toBe(1);
  await page.goto("/ru");
  const recent = page.locator('section[aria-labelledby="recent-heading"]');
  await expect(recent.getByRole("link", { name: "Футболка City" })).toBeVisible();
  await expect(page.locator('section[aria-labelledby="suggestions-heading"]').getByRole("link").first()).toBeVisible();
  await page.goto("/ru/account");
  const save = page.getByRole("checkbox", { name: "Сохранять просмотры на этом устройстве" });
  await save.uncheck();
  await page.goto("/ru/p/city-tee");
  await expect(page.getByRole("button", { name: "M", exact: true })).toBeEnabled();
  await page.goto("/ru/account");
  await expect(save).not.toBeChecked();
  await expect(page.locator('section[aria-labelledby="recent-heading"]').getByRole("link", { name: "Футболка City" })).toHaveCount(0);
  await save.check();
  await page.goto("/ru/p/city-tee");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("urbanmag:history:v1") || "{}").entries?.length)).toBe(1);
  await page.goto("/ru/account");
  await page.getByRole("button", { name: "Очистить историю", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("urbanmag:history:v1")!).entries)).toEqual([]);
  await page.reload();
  await expect(page.getByText("Откройте товар — он появится здесь.", { exact: true })).toBeVisible();
});

test("share fallback exposes a clean selectable link in every language", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("blocked"); } } });
  });
  for (const [locale, share, label] of [["ru", "Поделиться", "Ссылка на товар"], ["kk", "Бөлісу", "Тауар сілтемесі"], ["en", "Share", "Product link"]]) {
    await page.goto(`/${locale}/p/city-tee?private=value#ignored`);
    await page.getByRole("button", { name: share, exact: true }).click();
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(`https://localhost:3443/${locale}/p/city-tee`);
  }
});

test("purchases, read markers and private profile order search use actual returned states", async ({ page }) => {
  let status = "paid";
  const id = "aaaaaaaa-1111-2222-3333-444444444444";
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { user: { id: "buyer-ui-test", email: "buyer-ui@example.test", mustChangePassword: false } } }));
  await page.route("**/api/account/orders", (route) => route.fulfill({ json: [{ id, status, paymentStatus: "paid", total: 12500,
    lines: [{ variantId: "variant", name: "Футболка City", names: { ru: "Футболка City", kk: "City футболкасы", en: "City T-shirt" }, size: "M", color: "", quantity: 1, price: 12500 }] }] }));
  await page.goto("/ru/account");
  const notifications = page.locator("#notifications");
  await expect(notifications.getByText("#AAAAAAAA · Оплачен", { exact: true })).toBeVisible();
  await notifications.getByRole("button", { name: "Прочитать все", exact: true }).click();
  await page.reload();
  await expect(notifications.getByText("Прочитано", { exact: true })).toBeVisible();
  status = "ready";
  await page.getByRole("button", { name: "Обновить заказы", exact: true }).click();
  await expect(notifications.getByText("#AAAAAAAA · Готов к выдаче", { exact: true })).toBeVisible();
  await expect(notifications.getByRole("button", { name: "Отметить прочитанным", exact: true })).toBeEnabled();
  await page.getByLabel("Номер или код заказа", { exact: true }).fill("other-account-order");
  await page.getByRole("button", { name: "Проверить заказ", exact: true }).click();
  await expect(page.getByText("В вашем профиле заказ с таким номером не найден.", { exact: true })).toBeVisible();
  await page.getByLabel("Номер или код заказа", { exact: true }).fill(id);
  await page.getByRole("button", { name: "Проверить заказ", exact: true }).click();
  await expect(page.locator("#check-order").getByRole("heading", { name: "Состав заказа" })).toBeVisible();
});

test("order API denies another visitor and account purchases require authentication", async ({ page, browser }) => {
  await page.goto("/ru/p/city-tee");
  await expect.poll(async () => (await page.context().cookies()).some((cookie) => cookie.name.includes("urbanmag_visitor"))).toBe(true);
  const catalog = await (await page.request.get("/api/products?q=City")).json() as { products: Product[] };
  const product = catalog.products.find((item) => item.slug === "city-tee")!;
  const variant = product.sizes.find((size) => size.available > 0)!;
  const headers = { Origin: "https://localhost:3443" };
  expect((await page.request.patch("/api/cart", { headers, data: { variantId: variant.id, quantity: 1 } })).ok()).toBe(true);
  const checkout = await page.request.post("/api/checkout", { headers, data: { email: `privacy-${Date.now()}@example.test`, phone: "+77011234567", fulfillment: "pickup", locale: "ru", expectedTotal: product.price, idempotencyKey: crypto.randomUUID() } });
  expect(checkout.status()).toBe(201);
  const order = await checkout.json();
  expect((await page.request.get(`/api/orders/${order.id}`)).status()).toBe(200);
  const other = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const denied = await other.request.get(`https://localhost:3443/api/orders/${order.id}`);
    expect(denied.status()).toBe(404);
    const body = await denied.text();
    expect(body).not.toContain(order.email);
    expect(body).not.toContain(order.phone);
    expect((await other.request.get("https://localhost:3443/api/account/orders")).status()).toBe(401);
  } finally { await other.close(); }
});

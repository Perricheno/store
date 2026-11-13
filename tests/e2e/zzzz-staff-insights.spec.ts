import { expect, test, type Page } from "@playwright/test";
import type { Settings, StaffInsights } from "@urbanmag/core";

// Earlier staff scenarios establish this password. Do not rotate the shared fixture.
// This independent client has its own fixture IP; the complete suite shares one proxy.
async function owner(page: Page) {
 const response = await page.request.post("/api/staff/auth/login", { headers: { Origin: "https://localhost:3443", "x-real-ip": "127.0.0.52" }, data: { email: "owner@urbanmag.test", password: "Owner-permanent-password-2026!" } });
 expect(response.ok()).toBeTruthy();
 await page.goto("/staff");
 await expect(page.getByRole("heading", { name: "Сводка", exact: true })).toBeVisible();
}

test("staff summary uses SQL insights and analytics switches periods with historical categories", async ({ page }) => {
 await owner(page);
 const response = await page.request.get("/api/staff/insights?days=30");
 expect(response.ok()).toBeTruthy();
 const data = await response.json() as StaffInsights;
 expect(data.period.days).toBe(30);
 expect(data.daily).toHaveLength(30);
 await expect(page.getByRole("button", { name: "Сводка", exact: true })).toHaveAttribute("aria-current", "page");
 await expect(page.getByRole("heading", { name: "Каталог и остатки · Сейчас" })).toBeVisible();
 const metric = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Выручка завершённых заказов", exact: true }) });
 await expect(metric.locator("strong")).toHaveText(`${new Intl.NumberFormat("ru-KZ").format(data.revenue.completedAmount)} ₸`);
 await page.getByText("Качество данных", { exact: true }).click();
 await expect(page.getByText("Всего заказов в истории", { exact: true })).toBeVisible();
 await page.getByRole("button", { name: "Аналитика", exact: true }).click();
 const periodRequest = page.waitForResponse((result) => result.url().endsWith("/api/staff/insights?days=90"));
 await page.getByRole("combobox", { name: "Период", exact: true }).selectOption("90");
 expect((await periodRequest).ok()).toBeTruthy();
 await expect(page.getByRole("heading", { name: "Продажи по категориям" })).toBeVisible();
 await expect(page.getByText("Категория из снимка заказа.", { exact: false })).toBeVisible();
 await page.getByLabel("Language").selectOption("kk");
 await expect(page.getByRole("heading", { name: "Талдау", exact: true })).toBeVisible();
 await page.getByLabel("Language").selectOption("en");
 await expect(page.getByRole("heading", { name: "Analytics", exact: true })).toBeVisible();
 expect((await page.request.get("/api/staff/insights?days=14")).status()).toBe(400);
});

test("marketing and settings saves preserve each other's fields", async ({ page }) => {
 await owner(page);
 const original = await (await page.request.get("/api/staff/settings")).json() as Settings;
 try {
  await page.getByRole("button", { name: "Маркетинг", exact: true }).click();
  await page.getByText("Страницы", { exact: true }).click();
  const text = `Staff insights page ${Date.now()}`;
  await page.locator('textarea[name="content_about_ru"]').fill(text);
  const saved = page.waitForResponse((result) => result.url().endsWith("/api/staff/settings") && result.request().method() === "PATCH");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  expect((await saved).ok()).toBeTruthy();
  const afterMarketing = await (await page.request.get("/api/staff/settings")).json() as Settings;
  expect(afterMarketing.pickupCity).toBe(original.pickupCity);
  expect(afterMarketing.pickupAddress).toBe(original.pickupAddress);
  expect(afterMarketing.pickupHours).toBe(original.pickupHours);
  expect(afterMarketing.contentPages?.about?.ru).toBe(text);
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  const settingsSaved = page.waitForResponse((result) => result.url().endsWith("/api/staff/settings") && result.request().method() === "PATCH");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  expect((await settingsSaved).ok()).toBeTruthy();
  const afterSettings = await (await page.request.get("/api/staff/settings")).json() as Settings;
  expect(afterSettings.contentPages).toEqual(afterMarketing.contentPages);
  expect(afterSettings.announcement).toEqual(afterMarketing.announcement);
  expect(afterSettings.banner).toEqual(afterMarketing.banner);
 } finally {
  expect((await page.request.patch("/api/staff/settings", { headers: { Origin: "https://localhost:3443" }, data: original })).ok()).toBeTruthy();
 }
});

test("manager navigation is read only for marketing and insights recover from errors on mobile", async ({ page }) => {
 await owner(page);
 await page.route("**/api/staff/auth/me", async (route) => {
  const response = await route.fetch(); const result = await response.json();
  await route.fulfill({ json: { user: { ...result.user, role: "manager" } } });
 });
 let failing = true;
 await page.route("**/api/staff/insights?*", async (route) => {
  if (failing) await route.fulfill({ status: 503, json: { error: "Unavailable" } });
  else await route.continue();
 });
 await page.setViewportSize({ width: 390, height: 844 });
 await page.reload();
 await expect(page.getByRole("alert").filter({ hasText: "Не удалось загрузить показатели" })).toBeVisible();
 failing = false;
 await page.getByRole("button", { name: "Повторить", exact: true }).click();
 await expect(page.getByRole("heading", { name: "Выручка завершённых заказов", exact: true })).toBeVisible();
 await expect(page.getByRole("button", { name: "Команда", exact: true })).toHaveCount(0);
 await expect(page.getByRole("button", { name: "Настройки", exact: true })).toHaveCount(0);
 await page.getByRole("button", { name: "Маркетинг", exact: true }).click();
 await expect(page.getByText("Просмотр: изменения доступны владельцу.", { exact: true })).toBeVisible();
 await expect(page.locator('input[name="announcement_ru"]')).toBeDisabled();
 await expect(page.getByRole("button", { name: "Сохранить", exact: true })).toHaveCount(0);
 await page.getByRole("button", { name: "Помощь", exact: true }).click();
 await expect(page.getByRole("heading", { name: "Помощь сотруднику" })).toBeVisible();
 await expect(page.getByRole("link", { name: "Доставка и оплата" })).toHaveAttribute("href", "/ru/delivery");
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

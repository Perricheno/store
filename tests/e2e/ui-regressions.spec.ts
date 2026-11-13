import { test, expect } from "@playwright/test";
import sharp from "sharp";

test("category pages retain localized headings, metadata and URL", async ({
  page,
}) => {
  for (const [locale, title] of [
    ["ru", "Футболки"],
    ["kk", "Футболкалар"],
    ["en", "T-shirts"],
  ] as const) {
    await page.goto(`/${locale}/c/t-shirts`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
    await expect(page).toHaveTitle(new RegExp(title));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      new RegExp(title),
    );
    await expect(page).toHaveURL(new RegExp(`/${locale}/c/t-shirts`));
  }
});

test("product without a photo remains visible with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/ru/p/city-tee");
  const visual = page.locator('article svg[role="img"]').first();
  await expect(visual).toBeVisible();
  const gleam = visual.locator('g[mask] rect[class*="gleam"]');
  await expect(gleam).toBeHidden();
  await expect(gleam).toHaveCSS("animation-name", "none");
});

test("staff can open inventory dialog and attach a photo to a new product", async ({
  page,
}) => {
  await page.goto("/staff");
  await page.getByLabel("Почта", { exact: true }).fill("owner@urbanmag.test");
  await page
    .getByLabel("Пароль", { exact: true })
    .fill("Owner-permanent-password-2026!");
  const login = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/staff/auth/login") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  const loginResponse = await login;
  const workspace = page.getByRole("heading", { name: "Рабочее пространство" });
  if (loginResponse.status() === 401) {
    await page
      .getByLabel("Пароль", { exact: true })
      .fill("E2e-owner-password-2026!");
    const fallbackLogin = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/staff/auth/login") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    expect((await fallbackLogin).ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", { name: "Смените временный пароль" }),
    ).toBeVisible();
    await page
      .getByLabel("Пароль", { exact: true })
      .fill("E2e-owner-password-2026!");
    await page
      .getByLabel("Новый пароль, от 12 символов")
      .fill("Owner-permanent-password-2026!");
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  } else {
    expect(loginResponse.ok()).toBeTruthy();
  }
  await expect(workspace).toBeVisible();
  const stockButton = page
    .locator("tbody tr")
    .first()
    .locator("td")
    .nth(2)
    .getByRole("button")
    .first();
  await stockButton.click();
  const inventory = page.getByRole("dialog", { name: "Остатки по филиалам" });
  await expect(inventory).toBeVisible();
  await expect(
    inventory.getByRole("heading", { name: "Добавить филиал" }),
  ).toBeVisible();
  const branchRow = inventory
    .locator("form:has(input[name=branchId][type=hidden])")
    .first();
  const quantity = branchRow.locator("input[name=quantity]");
  await expect(quantity).toBeVisible();
  const originalQuantity = Number(await quantity.inputValue());
  await quantity.fill(String(originalQuantity + 1));
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/staff/inventory") &&
      response.request().method() === "PATCH",
  );
  const refreshed = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/staff/inventory") &&
      response.request().method() === "GET",
  );
  await branchRow.getByRole("button", { name: "Сохранить" }).click();
  expect((await saved).ok()).toBeTruthy();
  expect((await refreshed).ok()).toBeTruthy();
  await expect(quantity).toHaveValue(String(originalQuantity + 1));
  await page.keyboard.press("Escape");
  await expect(inventory).toBeHidden();
  await stockButton.click();
  await expect(inventory).toBeVisible();
  await expect(quantity).toHaveValue(String(originalQuantity + 1));
  await quantity.fill(String(originalQuantity));
  const restored = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/staff/inventory") &&
      response.request().method() === "PATCH",
  );
  const restoredRefresh = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/staff/inventory") &&
      response.request().method() === "GET",
  );
  await branchRow.getByRole("button", { name: "Сохранить" }).click();
  expect((await restored).ok()).toBeTruthy();
  expect((await restoredRefresh).ok()).toBeTruthy();
  await expect(quantity).toHaveValue(String(originalQuantity));
  await page.keyboard.press("Escape");
  await expect(inventory).toBeHidden();
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  const productDialog = page.locator("dialog[open]");
  await expect(
    productDialog.getByRole("heading", { name: "Новый товар" }),
  ).toBeVisible();
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#e60012" },
  })
    .png()
    .toBuffer();
  const uploaded = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/staff/uploads") &&
      response.request().method() === "POST",
  );
  await productDialog
    .locator("input[type=file]")
    .setInputFiles({ name: "test.png", mimeType: "image/png", buffer: png });
  const uploadResponse = await uploaded;
  expect(uploadResponse.ok()).toBeTruthy();
  const { url } = await uploadResponse.json();
  expect(url).toMatch(/^\/api\/media\/[a-f0-9]{64}\.webp$/);
  await expect(productDialog.locator("img")).toHaveAttribute("src", url);
  const mediaResponse = await page.request.get(url);
  expect(mediaResponse.status()).toBe(200);
  expect(mediaResponse.headers()["content-type"]).toContain("image/webp");
  await productDialog.getByRole("button", { name: "Закрыть" }).click();
  await expect(productDialog).toBeHidden();
});

test("loading gleam is masked to the category icon and remains on photo failure", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/products**", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const products = Array.isArray(data) ? data : data.products;
    products[0].media = ["/slow-photo.png"];
    await route.fulfill({ response, json: data });
  });
  await page.route("**/slow-photo.png", async (route) => {
    await pending;
    await route.abort();
  });
  await page.goto("/ru");
  await expect(
    page.getByRole("button", { name: "Показать ещё", exact: true }),
  ).toBeEnabled();
  await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === "/api/products" &&
        url.searchParams.get("sort") === "price-asc"
      );
    }),
    page
      .getByRole("combobox", { name: "Сортировка", exact: true })
      .selectOption("price-asc"),
  ]);
  const card = page
    .locator("article")
    .filter({ has: page.locator('img[src="/slow-photo.png"]') });
  const gleam = card.locator('svg g[mask] rect[class*="gleam"]');
  await expect(gleam).toBeVisible();
  expect(await gleam.locator("..").getAttribute("mask")).toMatch(
    /^url\(#.+\)$/,
  );
  await expect(card.locator("svg mask svg")).toHaveCount(1);
  const cardHref = await card
    .locator('a[href*="/p/"]')
    .first()
    .getAttribute("href");
  release();
  const failedCard = page
    .locator("article")
    .filter({ has: page.locator(`a[href="${cardHref}"]`) });
  await expect(failedCard.locator('img[src="/slow-photo.png"]')).toHaveCount(0);
  await expect(
    failedCard.locator('svg g[mask] rect[class*="gleam"]'),
  ).toBeVisible();
  await expect(failedCard.locator('svg[role="img"]')).toBeVisible();
});

test("checkout requires a new confirmation after the price changes", async ({
  page,
}) => {
  await page.goto("/ru/p/city-tee");
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page
    .getByRole("button", { name: "Добавить в корзину", exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page
      .getByRole("button", { name: "В корзине", exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  let checkoutPosts = 0;
  const totals: number[] = [];
  await page.route("**/api/checkout", async (route) => {
    checkoutPosts++;
    totals.push(route.request().postDataJSON().expectedTotal);
    if (checkoutPosts === 1) {
      await route.fulfill({
        status: 409,
        json: { code: "TOTAL_CHANGED", error: "Price changed" },
      });
    } else {
      await route.fulfill({
        json: {
          id: "test-order",
          status: "pending",
          paymentStatus: "pending",
          total: 15000,
        },
      });
    }
  });
  await page.route("**/api/cart", async (route) => {
    const response = await route.fetch();
    const cart = await response.json();
    if (checkoutPosts > 0 && cart.items.length) {
      cart.items[0].product.price = 15000;
      cart.total = 15000;
    }
    await route.fulfill({ response, json: cart });
  });
  await page.goto("/ru/checkout");
  await page
    .getByLabel("Email", { exact: true })
    .fill("price-change@example.test");
  await page.getByLabel("Телефон", { exact: true }).fill("+77011234567");
  const confirm = page.getByRole("button", {
    name: "Подтвердить заказ",
    exact: true,
  });
  await confirm.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Цена изменилась." }),
  ).toContainText(
    "Цена изменилась. Проверьте новую сумму и подтвердите заказ ещё раз.",
  );
  await expect(
    page
      .locator("form")
      .getByText(/15\s*000/)
      .first(),
  ).toBeVisible();
  expect(checkoutPosts).toBe(1);
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(
    page.getByRole("heading", { name: "Заказ оформлен." }),
  ).toBeVisible();
  expect(checkoutPosts).toBe(2);
  expect(totals).toEqual([12900, 15000]);
  await page.unrouteAll({ behavior: "wait" });
});

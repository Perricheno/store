import { expect, test, type Page } from "@playwright/test";
import type { Product } from "@urbanmag/core";

async function loginOwner(page: Page) {
  await page.goto("/staff");
  await page.getByLabel("Почта", { exact: true }).fill("owner@urbanmag.test");
  await page
    .getByLabel("Пароль", { exact: true })
    .fill("Owner-permanent-password-2026!");
  let login = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/staff/auth/login") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  if ((await login).status() === 401) {
    await page
      .getByLabel("Пароль", { exact: true })
      .fill("E2e-owner-password-2026!");
    login = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/staff/auth/login") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    expect((await login).ok()).toBeTruthy();
    await page
      .getByLabel("Пароль", { exact: true })
      .fill("E2e-owner-password-2026!");
    await page
      .getByLabel("Новый пароль, от 12 символов", { exact: true })
      .fill("Owner-permanent-password-2026!");
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Рабочее пространство" }),
  ).toBeVisible();
}

test("product editor persists hidden characteristics and translated promotion", async ({
  page,
}) => {
  await loginOwner(page);
  const response = await page.request.get("/api/staff/products");
  expect(response.ok()).toBeTruthy();
  const original = ((await response.json()) as Product[]).find(
    (product) => product.slug === "city-tee",
  )!;
  expect(original.details.length).toBeGreaterThan(0);
  const detail = original.details[0];
  try {
    await page.getByLabel("Поиск товаров").fill(original.names.ru);
    await page
      .getByRole("row")
      .filter({ hasText: original.names.ru })
      .getByRole("button", { name: "Изменить" })
      .click();
    const editor = page.getByRole("dialog");
    const characteristic = editor.getByRole("group", {
      name: "Характеристики товара · 1",
      exact: true,
    });
    await characteristic.getByLabel("Показывать характеристику").uncheck();
    const badge = editor.getByRole("group", {
      name: "Акционный бейдж",
      exact: true,
    });
    await badge.getByLabel("Показывать бейдж").check();
    for (const [locale, label] of [
      ["RU", "Особая цена"],
      ["KK", "Арнайы баға"],
      ["EN", "Special price"],
    ] as const) {
      await badge.getByLabel(`Текст бейджа · ${locale}`).fill(label);
    }
    await badge.getByLabel("Процент (необязательно)").fill("15");
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/staff/products") &&
        r.request().method() === "POST",
    );
    await editor
      .getByRole("button", { name: "Сохранить", exact: true })
      .click();
    expect((await saved).ok()).toBeTruthy();
    await expect(editor).not.toBeVisible();
    const updated = (
      (await (
        await page.request.get("/api/staff/products")
      ).json()) as Product[]
    ).find((product) => product.id === original.id)!;
    expect(updated.details[0]).toEqual({ ...detail, enabled: false });
    expect(updated.promotion).toEqual({
      enabled: true,
      label: { ru: "Особая цена", kk: "Арнайы баға", en: "Special price" },
      percent: 15,
    });
    const publicProduct = (
      (await (await page.request.get("/api/products?q=City")).json()) as {
        products: Product[];
      }
    ).products.find((product) => product.id === original.id)!;
    expect(publicProduct.details.some((row) => row.key === detail.key)).toBe(
      false,
    );
    for (const [locale, label] of [
      ["ru", "Особая цена"],
      ["kk", "Арнайы баға"],
      ["en", "Special price"],
    ] as const) {
      await page.goto(`/${locale}/p/${original.slug}`);
      await expect(
        page.getByText(`${label} −15%`, { exact: true }),
      ).toBeVisible();
      await expect(
        page.locator("dl dt").getByText(detail.label[locale], { exact: true }),
      ).toHaveCount(0);
    }
    await page.goto("/ru?q=City");
    await expect(
      page
        .getByRole("article")
        .filter({
          has: page.getByRole("link", { name: original.names.ru, exact: true }),
        })
        .getByText("Особая цена −15%", { exact: true }),
    ).toBeVisible();
  } finally {
    const restored = await page.request.post("/api/staff/products", {
      headers: { Origin: "https://localhost:3443" },
      data: { ...original, promotion: original.promotion ?? null },
    });
    expect(restored.ok()).toBeTruthy();
  }
});

async function chooseVariant(page: Page, product: Product) {
  const button = page.getByRole("button", {
    name: `Добавить в корзину: ${product.names.ru}`,
    exact: true,
  });
  await button.click();
  const available = product.sizes.filter((size) => size.available > 0);
  if (available.length > 1) {
    const dialog = page.getByRole("dialog", { name: "Выберите размер" });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", { name: new RegExp(`^${available[0].size}`) })
      .first()
      .click();
  }
}

for (const shouldFail of [false, true]) {
  test(`quick add ${shouldFail ? "rolls back a failed request" : "updates immediately and reconciles with the server"}`, async ({
    page,
  }) => {
    const catalog = (await (
      await page.request.get("/api/products?q=City")
    ).json()) as { products: Product[] };
    const product = catalog.products.find(
      (item) =>
        item.slug === "city-tee" &&
        item.sizes.some((size) => size.available > 0),
    )!;
    expect(product).toBeDefined();
    await page.goto("/ru?q=City");
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let received!: () => void;
    const requestStarted = new Promise<void>((resolve) => {
      received = resolve;
    });
    await page.route("**/api/cart", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      received();
      await pending;
      if (shouldFail)
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "test failure" }),
        });
      else await route.continue();
    });
    try {
      await chooseVariant(page, product);
      await requestStarted;
      await expect(
        page.getByRole("link", { name: "Корзина (1)", exact: true }).first(),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: `В корзине: ${product.names.ru}`,
          exact: true,
        }),
      ).toBeDisabled();
      const finished = page.waitForResponse(
        (r) => r.url().endsWith("/api/cart") && r.request().method() === "POST",
      );
      release();
      const result = await finished;
      expect(result.ok()).toBe(!shouldFail);
      if (shouldFail) {
        await expect(
          page.getByRole("link", { name: "Корзина", exact: true }).first(),
        ).toBeVisible();
        await expect(
          page
            .getByRole("status")
            .filter({ hasText: "Не удалось обновить корзину." }),
        ).toBeVisible();
      } else {
        const cart = await (await page.request.get("/api/cart")).json();
        expect(
          cart.items.reduce(
            (sum: number, item: { quantity: number }) => sum + item.quantity,
            0,
          ),
        ).toBe(1);
        await expect(
          page.getByRole("link", { name: "Корзина (1)", exact: true }).first(),
        ).toBeVisible();
      }
    } finally {
      release();
      await page.unroute("**/api/cart");
    }
  });
}

import { expect, test } from "@playwright/test";

test("mobile bag announces its quantity after quick add and reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ru?q=City");
  await page
    .getByRole("button", {
      name: "Добавить в корзину: Футболка City",
      exact: true,
    })
    .click();
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/cart") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("dialog", { name: "Выберите размер" })
    .getByRole("button", { name: "M", exact: true })
    .click();
  expect((await saved).ok()).toBeTruthy();
  const bag = page
    .locator('nav[class*="bottomNav"]')
    .getByRole("link", { name: "Корзина (1)", exact: true });
  await expect(bag).toBeVisible();
  await page.reload();
  await expect(bag).toBeVisible();
});

test("mobile footer is reserved for the profile and the header stays visible", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: "https://localhost:3443",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    ignoreHTTPSErrors: true,
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      const original = document.startViewTransition.bind(document);
      (
        window as typeof window & { routeTransitionCount: number }
      ).routeTransitionCount = 0;
      document.startViewTransition = ((
        ...args: Parameters<typeof original>
      ) => {
        (window as typeof window & { routeTransitionCount: number })
          .routeTransitionCount++;
        return original(...args);
      }) as typeof document.startViewTransition;
    });
    await page.goto("/ru");
    const footer = page.locator("footer");
    const nav = page.locator('nav[class*="bottomNav"]');
    await expect(footer).toBeHidden();
    const beforeTransition = await page.evaluate(
      () =>
        (window as typeof window & { routeTransitionCount: number })
          .routeTransitionCount,
    );
    await nav.getByRole("link", { name: "Корзина", exact: true }).click();
    await expect(page).toHaveURL(/\/ru\/cart$/);
    await expect(footer).toBeHidden();
    await nav
      .getByRole("link", { name: "Личный кабинет", exact: true })
      .click();
    await expect(page).toHaveURL(/\/ru\/account$/);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { routeTransitionCount: number })
              .routeTransitionCount,
        ),
      )
      .toBeGreaterThan(beforeTransition);
    await expect(footer).toBeVisible();
    expect((await footer.boundingBox())!.y).toBeGreaterThanOrEqual(844);
    await footer.scrollIntoViewIfNeeded();
    await expect
      .poll(async () => (await page.locator("header").boundingBox())!.y)
      .toBe(0);
    await expect(
      footer.getByRole("link", { name: "О магазине" }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("mobile controls and category gleam retain their intended styles", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: "https://localhost:3443",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    ignoreHTTPSErrors: true,
    reducedMotion: "no-preference",
  });
  try {
    const page = await context.newPage();
    await page.goto("/ru");
    const nav = page.locator('nav[class*="bottomNav"]');
    await expect(nav).toHaveCSS("backdrop-filter", "blur(18px)");
    await expect(nav).toHaveCSS("background-color", "rgba(255, 255, 255, 0.8)");
    await expect(
      nav.getByRole("link", { name: "Корзина", exact: true }),
    ).toHaveCSS("touch-action", "manipulation");

    const gleam = page
      .getByTestId("catalog-grid")
      .locator('div[data-gleam-visible] span[class*="gleam"]')
      .first();
    await expect(gleam).toBeVisible();
    const rotation = await gleam.evaluate((element) => {
      const matrix = new DOMMatrix(getComputedStyle(element).transform);
      return [matrix.a, matrix.b, matrix.c, matrix.d];
    });
    const diagonal = Math.SQRT1_2;
    for (const [actual, expected] of rotation.map((value, index) => [
      value,
      [diagonal, diagonal, -diagonal, diagonal][index],
    ])) {
      expect(actual).toBeCloseTo(expected, 4);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(gleam).toHaveCSS("animation-name", "none");
  } finally {
    await context.close();
  }
});

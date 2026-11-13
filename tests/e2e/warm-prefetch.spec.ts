import { expect, test } from "@playwright/test";

test("a prefetched cart opens while a later RSC request is held", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const cartPrefetch = page.waitForResponse((response) => {
    const request = response.request();
    return new URL(response.url()).pathname === "/ru/cart" &&
      request.headers().rsc === "1" &&
      request.headers()["next-router-prefetch"] === "1" &&
      response.ok();
  });
  await page.goto("/ru");
  const response = await cartPrefetch;
  expect(await response.finished()).toBeNull();
  const cart = page.locator('nav[class*="bottomNav"]').getByRole("link", { name: "Корзина", exact: true });
  await expect(cart).toBeVisible();

  let releaseRequest: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => { releaseRequest = resolve; });
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (new URL(request.url()).pathname === "/ru/cart" && request.headers().rsc === "1") {
      await blocked;
    }
    await route.continue();
  });
  try {
    await cart.click({ noWaitAfter: true });
    await expect(page.getByText("Ваша корзина пока пуста", { exact: true })).toBeVisible({ timeout: 1500 });
    await expect(page).toHaveURL(/\/ru\/cart$/);
  } finally {
    releaseRequest?.();
  }
});

import { expect, test } from "@playwright/test";

test("first visit waits for one visitor bootstrap before loading or changing favorites", async ({
  page,
  context,
}) => {
  let releaseBootstrap!: () => void;
  const bootstrapGate = new Promise<void>((resolve) => {
    releaseBootstrap = resolve;
  });
  let markBootstrapStarted!: () => void;
  const bootstrapStarted = new Promise<void>((resolve) => {
    markBootstrapStarted = resolve;
  });
  let firstCart = true;
  let favoriteReads = 0;
  let releaseMutation!: () => void;
  const mutationGate = new Promise<void>((resolve) => {
    releaseMutation = resolve;
  });
  await page.route("**/api/cart", async (route) => {
    if (firstCart && route.request().method() === "GET") {
      firstCart = false;
      markBootstrapStarted();
      await bootstrapGate;
    }
    await route.continue();
  });
  await page.route("**/api/favorites", async (route) => {
    if (route.request().method() === "GET") favoriteReads++;
    else await mutationGate;
    await route.continue();
  });
  try {
    await page.goto("/ru", { waitUntil: "domcontentloaded" });
    await bootstrapStarted;
    const heart = page
      .getByRole("button", { name: "В избранное", exact: true })
      .first();
    await expect(heart).toBeVisible();
    await expect(heart).toBeDisabled();
    expect(favoriteReads).toBe(0);
    // SSR products are already usable while visitor initialization is delayed.
    await expect(page.getByTestId("catalog-grid")).toBeVisible();
    await expect(page.getByText("Загружаем...", { exact: true })).toHaveCount(
      0,
    );
    releaseBootstrap();
    await expect(heart).toBeEnabled();
    const visitor = (await context.cookies()).find(
      (cookie) => cookie.name === "__Host-urbanmag_visitor",
    );
    expect(visitor).toBeDefined();
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/favorites") &&
        response.request().method() === "POST",
    );
    await heart.click();
    await expect(heart).toBeDisabled();
    releaseMutation();
    expect((await saved).ok()).toBeTruthy();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Убрать из избранного", exact: true }),
    ).toHaveCount(1);
    const restoredVisitor = (await context.cookies()).find(
      (cookie) => cookie.name === "__Host-urbanmag_visitor",
    );
    expect(restoredVisitor?.value).toBe(visitor?.value);
  } finally {
    releaseBootstrap();
    releaseMutation();
  }
});

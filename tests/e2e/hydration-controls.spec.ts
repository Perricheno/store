import { expect, test } from "@playwright/test";

for (const detail of [false, true]) {
  test(`${detail ? "product" : "catalog"} controls wait for handlers on a slow connection`, async ({
    page,
  }) => {
    let release!: () => void;
    const scripts = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/_next/static/**/*.js", async (route) => {
      await scripts;
      await route.continue();
    });
    try {
      await page.goto(detail ? "/ru/p/city-tee" : "/ru?q=City", {
        waitUntil: "commit",
      });
      const add = detail
        ? page
            .getByRole("button", { name: "Добавить в корзину", exact: true })
            .first()
        : page.getByRole("button", {
            name: "Добавить в корзину: Футболка City",
            exact: true,
          });
      await expect(add).toBeVisible();
      await expect(add).toBeDisabled();
      if (detail)
        await expect(
          page.getByRole("button", { name: "M", exact: true }),
        ).toBeDisabled();
      release();
      await expect(add).toBeEnabled();
      if (detail) {
        await page.getByRole("button", { name: "M", exact: true }).click();
        await add.click();
        await expect(
          page.getByRole("button", { name: "В корзине", exact: true }).first(),
        ).toBeVisible();
      } else {
        await add.click();
        await expect(
          page.getByRole("dialog", { name: "Выберите размер" }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: "Корзина (1)", exact: true }).first(),
        ).toBeVisible();
      }
    } finally {
      release();
      await page.unrouteAll({ behavior: "wait" });
    }
  });
}

test("cart size selection waits for handlers on a slow connection", async ({ page }) => {
  const { products } = await (await page.request.get("/api/products?q=City")).json();
  const product = products.find((item: { slug: string }) => item.slug === "city-tee");
  const added = await page.request.post("/api/cart", {
    headers: { Origin: "https://localhost:3443" },
    data: { productId: product.id, quantity: 1 },
  });
  expect(added.ok()).toBeTruthy();
  let release!: () => void;
  const scripts = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/_next/static/**/*.js", async (route) => {
    await scripts;
    await route.continue();
  });
  try {
    await page.goto("/ru/cart", { waitUntil: "commit" });
    const size = page.getByRole("article").getByRole("combobox");
    await expect(size).toBeVisible();
    await expect(size).toBeDisabled();
    release();
    await expect(size).toBeEnabled();
    const saved = page.waitForResponse((response) => response.url().endsWith("/api/cart") && response.request().method() === "PATCH");
    await size.selectOption(product.sizes.find((variant: { available: number }) => variant.available > 0).id);
    expect((await saved).ok()).toBeTruthy();
    await expect(size).not.toHaveValue("");
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});

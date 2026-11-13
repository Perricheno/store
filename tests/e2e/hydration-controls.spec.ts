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
        ).toBeVisible();
      }
    } finally {
      release();
      await page.unrouteAll({ behavior: "wait" });
    }
  });
}

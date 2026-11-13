import { test, expect } from "@playwright/test";

test("staff product search and pagination limit rendered rows", async ({
  page,
}) => {
  const products = Array.from({ length: 30 }, (_, index) => ({
    id: `fixture-${index}`,
    slug: `item-${index}`,
    brand: "Example",
    category: "shirts",
    names: { ru: `Товар ${index}`, kk: `Тауар ${index}`, en: `Item ${index}` },
    price: 1000,
    sizes: [],
    isDemo: true,
    published: true,
  }));
  await page.route("**/api/staff/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const result = path.endsWith("/auth/me")
      ? {
          user: {
            id: "fixture",
            email: "staff@example.test",
            role: "manager",
            mustChangePassword: false,
          },
        }
      : path.endsWith("/products")
        ? products
        : path.endsWith("/orders")
          ? []
          : {};
    await route.fulfill({ json: result });
  });
  await page.goto("/staff");
  await expect(
    page.getByRole("heading", { name: "Рабочее пространство" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Товары", exact: true }).click();
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(24);
  await page.getByRole("button", { name: "Следующая", exact: true }).click();
  await expect(rows).toHaveCount(6);
  await expect(page.getByText("Товар 24", { exact: true })).toBeVisible();
  await page.getByLabel("Поиск товаров").fill("item-29");
  await expect(rows).toHaveCount(1);
  await expect(page.getByText("Товар 29", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Предыдущая", exact: true }),
  ).toBeDisabled();
});

import { expect, test } from "@playwright/test";

for (const width of [360, 1440]) {
  test(`filter drafts, validation, chips and history at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/ru?sort=price-asc&q=City");
    const trigger = page.getByRole("button", { name: /^Фильтры/ });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: /^Фильтры/ });
    await dialog.getByRole("button", { name: "M", exact: true }).click();
    await dialog.getByRole("checkbox", { name: "Только в наличии", exact: true }).check();
    await expect(page).not.toHaveURL(/size=/);
    await page.keyboard.press("Escape");
    await trigger.click();
    await expect(dialog.getByRole("button", { name: "M", exact: true })).toHaveAttribute("aria-pressed", "false");
    await expect(dialog.getByRole("checkbox", { name: "Только в наличии", exact: true })).not.toBeChecked();
    await dialog.getByRole("button", { name: "M", exact: true }).click();
    const min = dialog.locator('input[name="minPrice"]');
    const max = dialog.locator('input[name="maxPrice"]');
    await min.fill("20000");
    await max.fill("10000");
    await dialog.getByRole("button", { name: "Показать вещи", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog).toBeVisible();
    await max.fill("30000");
    await dialog.getByRole("button", { name: "Показать вещи", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/size=M/);
    expect(new URL(page.url()).searchParams.get("q")).toBe("City");
    expect(new URL(page.url()).searchParams.get("sort")).toBe("price-asc");
    await expect(trigger).toContainText("2");
    const chips = page.getByRole("group", { name: "Выбранные фильтры", exact: true });
    await chips.getByRole("button", { name: "Убрать: Размер: M", exact: true }).click();
    await expect(page).not.toHaveURL(/size=/);
    await page.goBack();
    await expect(page).toHaveURL(/size=M/);
    await expect(chips.getByRole("button", { name: "Убрать: Размер: M", exact: true })).toBeVisible();
    await page.goForward();
    await expect(page).not.toHaveURL(/size=/);
    await chips.getByRole("button", { name: "Сбросить", exact: true }).click();
    await expect(page).toHaveURL(/q=City&sort=price-asc$/);
    await expect(chips).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test("applied category resets pagination and keeps search/order across reload and back", async ({ page }) => {
  await page.goto("/en/c/sneakers?sort=price-desc");
  await page.getByRole("button", { name: /^Filters/ }).click();
  const dialog = page.getByRole("dialog", { name: /^Filters/ });
  await dialog.getByRole("combobox", { name: "Categories", exact: true }).selectOption("socks");
  await dialog.getByRole("checkbox", { name: "In stock only", exact: true }).check();
  const response = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/products" && url.searchParams.get("category") === "socks" && url.searchParams.get("page") === "1";
  });
  await dialog.getByRole("button", { name: "Show pieces", exact: true }).click();
  expect((await response).ok()).toBeTruthy();
  await expect(page).toHaveURL(/category=socks/);
  expect(new URL(page.url()).searchParams.get("sort")).toBe("price-desc");
  expect(new URL(page.url()).searchParams.get("available")).toBe("true");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Socks");
  await page.goBack();
  await expect(page).toHaveURL(/\/en\/c\/sneakers\?sort=price-desc$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sneakers");
});

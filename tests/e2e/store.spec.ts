import { test, expect } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createHmac } from "node:crypto";
test("catalog, three languages, filters and mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const locale of ["ru", "kk", "en"]) {
    await page.goto(`/${locale}`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/ru?gender=women");
  await expect(page.locator("h1")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
  await page
    .getByRole("combobox", { name: "Язык", exact: true })
    .selectOption("kk");
  await expect(page).toHaveURL(/\/kk\?gender=women/);
  expect(errors).toEqual([]);
});
test("favorite persists across reload and can be removed", async ({ page }) => {
  await page.goto("/ru");
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/favorites") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "В избранное", exact: true })
    .first()
    .click();
  expect((await saved).ok()).toBeTruthy();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Убрать из избранного", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("link", { name: "Избранное", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Убрать из избранного", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Убрать из избранного", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Сохраните то, что нравится" }),
  ).toBeVisible();
});
test("guest checkout, mock payment, email password, account and staff processing", async ({
  page,
  browser,
}) => {
  const email = `buyer-${Date.now()}@example.test`;
  await page.goto("/ru/p/city-tee");
  await page.getByRole("button", { name: "M", exact: true }).click();
  await page
    .getByRole("button", { name: "Добавить в корзину", exact: true })
    .filter({ visible: true })
    .click();
  await page.goto("/ru/cart");
  await expect(page.getByText("Футболка City", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Футболка City", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Оформить заказ" }).click();
  await expect(
    page.getByText("Пока недоступно", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Телефон", { exact: true }).fill("+77011234567");
  await page.getByRole("button", { name: "Подтвердить заказ" }).click();
  await expect(
    page.getByRole("heading", { name: "Заказ оформлен." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Симулировать оплату" }).click();
  await expect(page.getByRole("heading", { name: "Оплачен." })).toBeVisible();
  const mailDir = path.resolve(".data/e2e/mail");
  let text = "";
  for (const file of await readdir(mailDir)) {
    const mail = JSON.parse(await readFile(path.join(mailDir, file), "utf8"));
    if (mail.to === email) text = mail.text;
  }
  const temporary = text.match(/Ваш временный пароль: (\S+)/)?.[1];
  expect(temporary).toBeTruthy();
  await page.goto("/ru/account");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(temporary!);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    page.getByText("Вы вошли с временным паролем.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Текущий пароль", { exact: true }).fill(temporary!);
  await page
    .getByLabel("Новый пароль", { exact: false })
    .fill("Buyer-permanent-password-2026!");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("Пароль изменён", { exact: true })).toBeVisible();
  await expect(page.getByText("Оплачен", { exact: true })).toBeVisible();
  const context = await browser.newContext();
  const staff = await context.newPage();
  await staff.goto("/staff");
  await staff.getByLabel("Почта", { exact: true }).fill("owner@urbanmag.test");
  await staff
    .getByLabel("Пароль", { exact: true })
    .fill("E2e-owner-password-2026!");
  await staff.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    staff.getByRole("heading", { name: "Смените временный пароль" }),
  ).toBeVisible();
  await staff
    .getByLabel("Пароль", { exact: true })
    .fill("E2e-owner-password-2026!");
  await staff
    .getByLabel("Новый пароль, от 12 символов", { exact: true })
    .fill("Owner-permanent-password-2026!");
  await staff.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    staff.getByRole("heading", { name: "Рабочее пространство" }),
  ).toBeVisible();
  await staff.getByRole("button", { name: "Заказы", exact: true }).click();
  await expect(staff.getByText(email, { exact: true })).toBeVisible();
  await staff
    .getByRole("button", { name: "Заказ", exact: true })
    .first()
    .click();
  await staff.getByRole("button", { name: "В сборке", exact: true }).click();
  await context.close();
});
test("backend rejects disabled delivery, forged origin and anonymous staff access", async ({
  request,
}) => {
  const cookieProbe = await request.get("/api/cart");
  const visitorCookie = cookieProbe.headers()["set-cookie"] || "";
  expect(visitorCookie).toContain("__Host-urbanmag_visitor=");
  expect(visitorCookie.toLowerCase()).toContain("secure");
  expect(visitorCookie.toLowerCase()).toContain("httponly");
  expect(visitorCookie.toLowerCase()).toContain("samesite=lax");
  expect(visitorCookie.toLowerCase()).not.toContain("domain=");
  const origin = "https://localhost:3443";
  const catalog = await (await request.get("/api/products")).json();
  const p = catalog.products[0];
  await request.patch("/api/cart", {
    headers: { Origin: origin },
    data: { variantId: p.sizes[0].id, quantity: 1 },
  });
  const shipping = await request.post("/api/checkout", {
    headers: { Origin: origin },
    data: {
      email: "delivery@example.test",
      phone: "+77011234567",
      fulfillment: "kazpost",
      expectedTotal: p.price,
      idempotencyKey: "shipping-blocked-test",
      locale: "ru",
    },
  });
  expect(shipping.ok()).toBeFalsy();
  expect(
    (
      await request.patch("/api/cart", {
        headers: { Origin: "https://attacker.invalid" },
        data: { variantId: p.sizes[0].id, quantity: 2 },
      })
    ).status(),
  ).toBe(403);
  expect((await request.get("/api/staff/products")).status()).toBe(401);
  const raw = JSON.stringify({ event: "webhook.test" });
  expect(
    (
      await request.post("/api/webhooks/apipay", {
        headers: {
          "x-webhook-signature": "sha256=bad",
          "Content-Type": "application/json",
        },
        data: raw,
      })
    ).status(),
  ).toBe(401);
  const signature =
    "sha256=" +
    createHmac("sha256", "urbanmag-e2e-public-signature-fixture")
      .update(raw)
      .digest("hex");
  expect(
    (
      await request.post("/api/webhooks/apipay", {
        headers: {
          "x-webhook-signature": signature,
          "Content-Type": "application/json",
        },
        data: raw,
      })
    ).status(),
  ).toBe(200);
  const seo = await request.get("/ru");
  expect(seo.headers()["x-robots-tag"]).toContain("noindex");
  expect((await request.get("/sitemap.xml")).status()).toBe(404);
});

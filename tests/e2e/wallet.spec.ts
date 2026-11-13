import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const origin = "https://localhost:3443";
test("funded buyer balance: confirmed account, mock invoice, wallet checkout and truthful failed load", async ({
  page,
}) => {
  const email = `wallet-ui-${randomUUID()}@example.test`,
    permanent = "Wallet-buyer-password-2026!";
  const api = page.request;
  await api.get("/api/cart");
  const catalog = await (await api.get("/api/products?available=true")).json();
  const product = catalog.products.find((p: any) =>
    p.sizes.some((v: any) => v.available >= 4),
  );
  expect(product).toBeTruthy();
  const variant = product.sizes.find((v: any) => v.available >= 4).id,
    price = product.price;
  expect(
    (
      await api.patch("/api/cart", {
        headers: { Origin: origin },
        data: { variantId: variant, quantity: 1 },
      })
    ).ok(),
  ).toBeTruthy();
  const bootstrap = await api.post("/api/checkout", {
    headers: { Origin: origin },
    data: {
      email,
      phone: "+77011234567",
      fulfillment: "pickup",
      expectedTotal: price,
      idempotencyKey: randomUUID(),
      locale: "ru",
    },
  });
  expect(bootstrap.status()).toBe(201);
  let text = "";
  for (const file of await readdir(path.resolve(".data/e2e/mail"))) {
    const mail = JSON.parse(
      await readFile(path.resolve(".data/e2e/mail", file), "utf8"),
    );
    if (mail.to === email) text = mail.text;
  }
  const temporary = text.match(/Ваш временный пароль: (\S+)/)?.[1];
  expect(temporary).toBeTruthy();
  expect(
    (
      await api.post("/api/auth/login", {
        headers: { Origin: origin },
        data: { email, password: temporary },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/ru/account/wallet");
  await expect(
    page.getByText("Сначала смените временный пароль в личном кабинете.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("wallet-balance")).toHaveCount(0);
  await page.goto("/ru/account");
  await page.getByLabel("Текущий пароль", { exact: true }).fill(temporary!);
  await page.getByLabel("Новый пароль", { exact: false }).fill(permanent);
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("Пароль изменён", { exact: true })).toBeVisible();
  expect(
    (
      await api.patch("/api/cart", {
        headers: { Origin: origin },
        data: { variantId: variant, quantity: 1 },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto("/ru/checkout");
  await page
    .getByRole("radio", { name: "С денежного баланса", exact: false })
    .check();
  await expect(
    page.getByText("Недостаточно средств на балансе.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Подтвердить заказ", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("link", { name: "Пополнить баланс", exact: true })
    .click();
  await expect(page.getByTestId("wallet-balance")).toContainText("0");
  await expect(
    page.getByText("Тестовый баланс · без реальных денег", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Сумма в тенге", { exact: true })
    .fill(String(price * 2));
  await page.getByLabel("Телефон Kaspi", { exact: true }).fill("+77011234567");
  // Lose the response after acceptance, then retry the persisted attempt after reload.
  await page.route("**/api/wallet/topups", async (route) => {
    await route.fetch();
    await route.abort("failed");
  });
  await page
    .getByRole("button", { name: "Выставить счёт", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Повторите с теми же данными",
  );
  expect((await (await api.get("/api/wallet")).json()).topups).toHaveLength(1);
  await page
    .getByLabel("Сумма в тенге", { exact: true })
    .fill(String(price * 3));
  await page
    .getByLabel("Сумма в тенге", { exact: true })
    .fill(String(price * 2));
  await page.getByLabel("Телефон Kaspi", { exact: true }).fill("+77011234567 ");
  await page.unroute("**/api/wallet/topups");
  await page.reload();
  await expect(page.getByLabel("Сумма в тенге", { exact: true })).toHaveValue(
    String(price * 2),
  );
  await page.getByLabel("Телефон Kaspi", { exact: true }).fill("+77011234567 ");
  await page
    .getByRole("button", { name: "Выставить счёт", exact: true })
    .click();
  expect((await (await api.get("/api/wallet")).json()).topups).toHaveLength(1);
  await expect(
    page.getByRole("button", {
      name: "Тестовая оплата · без реальных списаний",
      exact: true,
    }),
  ).toBeVisible();
  expect((await (await api.get("/api/wallet")).json()).balance).toBe(0);
  await page
    .getByRole("button", {
      name: "Тестовая оплата · без реальных списаний",
      exact: true,
    })
    .click();
  await expect
    .poll(async () =>
      (await api.get("/api/wallet")).json().then((w) => w.balance),
    )
    .toBe(price * 2);
  await expect(
    page.getByRole("cell", { name: "Пополнение", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("wallet-balance")).toBeVisible();
  await page
    .getByRole("link", { name: "К оформлению заказа", exact: true })
    .click();
  await page
    .getByRole("radio", { name: "С денежного баланса", exact: false })
    .check();
  await page.getByLabel("Телефон", { exact: true }).fill("+77011234567");
  await expect(
    page.getByRole("button", { name: "Подтвердить заказ", exact: true }),
  ).toBeEnabled();
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/checkout") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Подтвердить заказ", exact: true })
    .click();
  const paid = await (await response).json();
  expect(paid.paymentMethod).toBe("wallet");
  expect(paid.paymentStatus).toBe("paid");
  await expect(
    page.getByRole("heading", { name: "Оплачен.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Заказ оплачен с денежного баланса.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Симулировать оплату", exact: true }),
  ).toHaveCount(0);
  expect((await (await api.get("/api/wallet")).json()).balance).toBe(price);
  await page.goto("/ru/account/wallet");
  await expect(page.getByRole("cell", { name: /Оплата заказа/ })).toBeVisible();
  await page.route("**/api/wallet", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unavailable" }),
    }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Сумма не подтверждена");
  await expect(page.getByTestId("wallet-balance")).toHaveCount(0);
  await page.unroute("**/api/wallet");
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.getByTestId("wallet-balance")).toBeVisible();
  // Staff refunds return the original debit once; ApiPay orders never offer this action.
  const staffLogin = async (password: string) =>
    api.post("/api/staff/auth/login", {
      headers: { Origin: origin },
      data: { email: "owner@urbanmag.test", password },
    });
  let staffSession = await staffLogin("Owner-permanent-password-2026!");
  if (staffSession.status() === 401) {
    staffSession = await staffLogin("E2e-owner-password-2026!");
    expect(staffSession.ok()).toBeTruthy();
    expect(
      (
        await api.patch("/api/staff/auth/password", {
          headers: { Origin: origin },
          data: {
            currentPassword: "E2e-owner-password-2026!",
            newPassword: "Owner-permanent-password-2026!",
          },
        })
      ).ok(),
    ).toBeTruthy();
  }
  expect(staffSession.ok()).toBeTruthy();
  await page.goto("/staff");
  await page.getByRole("button", { name: "Заказы", exact: true }).click();
  const bootstrapOrder = await bootstrap.json();
  await page
    .getByRole("row")
    .filter({ hasText: bootstrapOrder.id.slice(0, 8).toUpperCase() })
    .getByRole("button", { name: "Заказ", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Вернуть на баланс", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Закрыть", exact: true })
    .click();
  const walletRow = page
    .getByRole("row")
    .filter({ hasText: paid.id.slice(0, 8).toUpperCase() });
  await walletRow.getByRole("button", { name: "Заказ", exact: true }).click();
  const refunded = page.waitForResponse(
    (result) =>
      result.url().endsWith(`/api/staff/orders/${paid.id}/wallet-refund`) &&
      result.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Вернуть на баланс", exact: true })
    .click();
  expect((await refunded).ok()).toBeTruthy();
  await expect(walletRow).toContainText("Возвращён");
  await walletRow.getByRole("button", { name: "Заказ", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Вернуть на баланс", exact: true }),
  ).toHaveCount(0);
  const duplicate = await api.post(
    `/api/staff/orders/${paid.id}/wallet-refund`,
    { headers: { Origin: origin } },
  );
  expect(await duplicate.json()).toMatchObject({ duplicate: true });
  const wallet = await (await api.get("/api/wallet")).json();
  expect(wallet.balance).toBe(price * 2);
  expect(
    wallet.entries.filter(
      (entry: any) =>
        entry.kind === "order_refund" && entry.orderId === paid.id,
    ),
  ).toHaveLength(1);
});

test("wallet guest route is guarded and three-language access copy fits mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const [locale, title] of [
    ["ru", "Денежный баланс"],
    ["kk", "Ақшалай баланс"],
    ["en", "Money balance"],
  ]) {
    await page.goto(`/${locale}/account/wallet`);
    await expect(
      page.getByRole("heading", { name: `${title}.`, exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("wallet-balance")).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(360);
  }
  expect((await page.request.get("/api/wallet")).status()).toBe(401);
});

import { expect, test } from "@playwright/test";
import type { Product } from "@urbanmag/core";

test.describe("cart data in streamed server HTML", () => {
  // Next loading.tsx streams completed content into a hidden segment and uses
  // inline JavaScript to reveal it. With JavaScript disabled, assert that the
  // server supplied actual DOM content; visibility is a separate browser contract.
  test.use({ javaScriptEnabled: false });

  test("empty cart and checkout HTML contain initial state without creating a visitor", async ({
    page,
    context,
  }) => {
    for (const route of ["cart", "checkout"]) {
      const response = await page.goto(`/ru/${route}`);
      expect(response?.status()).toBe(200);
      await expect(
        page.getByText("Ваша корзина пока пуста", { exact: true }),
      ).toHaveCount(1);
      expect(
        (await context.cookies()).some((cookie) =>
          cookie.name.includes("urbanmag_visitor"),
        ),
      ).toBe(false);
    }
  });

  test("malformed visitor cookie produces empty cart HTML without rewriting cookies", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "__Host-urbanmag_visitor",
        value: "invalid-visitor",
        url: "https://localhost:3443",
        secure: true,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const response = await page.goto("/ru/cart");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByText("Ваша корзина пока пуста", { exact: true }),
    ).toHaveCount(1);
    expect(
      (await context.cookies()).find(
        (cookie) => cookie.name === "__Host-urbanmag_visitor",
      )?.value,
    ).toBe("invalid-visitor");
  });

  test("existing secure visitor cookie restores cart and checkout in server HTML", async ({
    page,
    context,
  }) => {
    const probe = await context.request.get("/api/cart");
    expect(probe.ok()).toBeTruthy();
    const visitor = (await context.cookies()).find(
      (cookie) => cookie.name === "__Host-urbanmag_visitor",
    );
    expect(visitor).toBeDefined();
    expect(visitor?.httpOnly).toBe(true);
    expect(visitor?.secure).toBe(true);
    const catalogResponse = await context.request.get("/api/products");
    expect(catalogResponse.ok()).toBeTruthy();
    const catalog = (await catalogResponse.json()) as { products: Product[] };
    const product = catalog.products.find((item) =>
      item.sizes.some((size) => size.available > 0),
    );
    expect(product).toBeDefined();
    const variant = product!.sizes.find((size) => size.available > 0)!;
    const updated = await context.request.patch("/api/cart", {
      headers: { Origin: "https://localhost:3443" },
      data: { variantId: variant.id, quantity: 1 },
    });
    expect(updated.ok()).toBeTruthy();
    expect(updated.headers()["cache-control"]).toContain("no-store");
    for (const route of ["cart", "checkout"]) {
      const response = await page.goto(`/ru/${route}`);
      expect(response?.status()).toBe(200);
      await expect(
        page.getByText(product!.names.ru, { exact: route === "cart" }).first(),
      ).toHaveCount(1);
      await expect(
        page.getByText("Ваша корзина пока пуста", { exact: true }),
      ).toHaveCount(0);
    }
    await expect(
      page.locator('input[type="email"][aria-label="Email"]'),
    ).toHaveCount(1);
  });
});

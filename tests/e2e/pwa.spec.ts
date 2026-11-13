import { test, expect } from "@playwright/test";

test("manifest provides usable installation icons", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.name).toBe("Urbanmag");
  expect(manifest.start_url).toBe("/ru");
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    const file = await request.get(icon.src);
    expect(file.ok()).toBeTruthy();
    expect(file.headers()["content-type"]).toContain("image/png");
  }
  expect(
    manifest.icons.some(
      (icon: { purpose?: string }) => icon.purpose === "maskable",
    ),
  ).toBeTruthy();
});

test("offline fallback caches no private pages or API responses", async ({
  page,
  context,
}) => {
  await page.goto("/ru");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.goto("/ru/cart");
  await page.request.get("/api/cart");
  await page.goto("/ru/account");
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const entries = await Promise.all(
      names.map(async (name) =>
        (await (await caches.open(name)).keys()).map(
          (request) => new URL(request.url).pathname,
        ),
      ),
    );
    return entries.flat();
  });
  expect(cached).toContain("/offline.html");
  expect(
    cached.filter((path) =>
      /\/(api|staff|cart|checkout|account|favorites)(\/|$)/.test(path),
    ),
  ).toEqual([]);
  await context.setOffline(true);
  await page.goto("/ru");
  await expect(
    page.getByText("Нет соединения с интернетом.", { exact: false }),
  ).toBeVisible();
  await expect(page.goto("/ru/account")).rejects.toThrow();
  await context.setOffline(false);
});

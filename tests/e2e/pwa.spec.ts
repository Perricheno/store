import { test, expect } from "@playwright/test";
import sharp from "sharp";

test("manifest provides usable installation icons", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.name).toBe("Urbanmag");
  expect(manifest.start_url).toBe("/ru");
  expect(manifest.display).toBe("standalone");
  const favicon = await (await request.get("/favicon.ico")).body();
  const pngOffset = favicon.readUInt32LE(18);
  const original = favicon.subarray(pngOffset);
  for (const icon of manifest.icons) {
    const file = await request.get(icon.src);
    expect(file.ok()).toBeTruthy();
    expect(file.headers()["content-type"]).toContain("image/png");
    const body = await file.body();
    const image = sharp(body);
    const metadata = await image.metadata();
    const size = Number(icon.sizes.split("x")[0]);
    expect([metadata.width, metadata.height]).toEqual([size, size]);
    if (icon.purpose === "any") {
      const expected = await sharp(original).resize(size, size).raw().toBuffer();
      expect(await image.raw().toBuffer()).toEqual(expected);
    }
  }
  expect(
    manifest.icons.some(
      (icon: { purpose?: string }) => icon.purpose === "maskable",
    ),
  ).toBeTruthy();
});

test("Apple and browser icons use the favicon mark", async ({ page, request }) => {
  await page.goto("/ru");
  const apple = page.locator('link[rel="apple-touch-icon"]');
  await expect(apple).toHaveAttribute("href", "/icons/urbanmag-180.png");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.ico");
  const ico = await (await request.get("/favicon.ico")).body();
  const icon = await (await request.get("/icons/urbanmag-180.png")).body();
  const expected = await sharp(ico.subarray(ico.readUInt32LE(18))).resize(180, 180).raw().toBuffer();
  expect(await sharp(icon).raw().toBuffer()).toEqual(expected);
});

test("offline fallback caches no private pages or API responses", async ({
  page,
  context,
}) => {
  await page.goto("/ru");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  // A real FontFace load has destination "font", just like Next's preloaded assets.
  const generatedFont = await page.evaluate(async () => {
    await document.fonts.ready;
    const entry = performance.getEntriesByType("resource").find((resource) =>
      /\/_next\/static\/media\/[^/]+\.woff2(?:\?|$)/.test(resource.name),
    );
    if (!entry) throw new Error("Next did not request a generated font");
    const font = new FontFace("cache-check", `url("${entry.name}")`);
    await font.load();
    return new URL(entry.name).pathname;
  });
  await page.goto("/ru/cart");
  await page.evaluate(() => fetch("/api/cart"));
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
  expect(cached).toContain(generatedFont);
  for (const subset of ["latin", "latin-ext", "cyrillic", "cyrillic-ext", "currency"]) {
    expect(cached).toContain(`/fonts/inter-${subset}-wght-normal.woff2`);
  }
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

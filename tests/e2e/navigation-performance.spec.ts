import { expect, test } from "@playwright/test";

test("mobile tabs keep their navigation node, font and position across client transitions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/ru");
  const nav = page.locator('nav[class*="bottomNav"]');
  await expect(nav).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    (window as Window & { originalBottomNav?: Element | null }).originalBottomNav = document.querySelector('nav[class*="bottomNav"]');
  });

  const snapshot = () => nav.evaluate((element) => {
    const original = (window as Window & { originalBottomNav?: Element | null }).originalBottomNav;
    const link = element.querySelector("a")!;
    const style = getComputedStyle(link);
    const box = element.getBoundingClientRect();
    const families = style.fontFamily.split(",").map((family) => family.trim());
    return {
      sameNode: element === original,
      documentNavigations: performance.getEntriesByType("navigation").length,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      fontsLoaded: document.fonts.check(`650 11px ${families[0]}`, "Urbanmag") &&
        document.fonts.check(`650 11px ${families[1]}`, "Каталог"),
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
    };
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const usedFonts = async (selector: string) => {
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    expect(nodeId).not.toBe(0);
    return (await cdp.send("CSS.getPlatformFontsForNode", { nodeId })).fonts;
  };
  const expectInterGlyphs = async (selector: string) => {
    const fonts = await usedFonts(selector);
    expect(fonts.length).toBeGreaterThan(0);
    expect(fonts.every((font) => font.isCustomFont && /inter/i.test(font.familyName) && font.glyphCount > 0)).toBe(true);
  };
  const labelSelector = 'nav[class*="bottomNav"] a:first-child span:nth-child(2)';
  const before = await snapshot();
  expect(before.fontsLoaded).toBe(true);
  await expectInterGlyphs(labelSelector);

  // These Kazakh characters are in the extended Cyrillic subset. Inspect the
  // font Chrome actually renders, including its bold weight, rather than just
  // the CSS family list or FontFaceSet.check's fallback-compatible result.
  await page.evaluate(async () => {
    const link = document.querySelector('nav[class*="bottomNav"] a')!;
    const probe = document.createElement("span");
    probe.id = "kazakh-font-probe";
    probe.textContent = "ӘҚҢӨҮҺ";
    probe.style.cssText = `position:fixed;top:0;left:0;font:${getComputedStyle(link).font}`;
    document.body.append(probe);
    probe.getBoundingClientRect();
    await document.fonts.ready;
  });
  await expectInterGlyphs("#kazakh-font-probe");
  await page.locator("#kazakh-font-probe").evaluate((element) => element.remove());

  for (const [label, path] of [
    ["Корзина", "/ru/cart"],
    ["Личный кабинет", "/ru/account"],
    ["Избранное", "/ru/favorites"],
  ]) {
    const link = nav.getByRole("link", { name: label, exact: true });
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(link).toHaveAttribute("aria-current", "page");
    expect(await snapshot()).toEqual(before);
    await expectInterGlyphs(labelSelector);
  }
});

test("a delayed tab transition immediately exposes its pending indicator", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  let clicked = false;
  let releaseRequest: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => { releaseRequest = resolve; });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const isRsc = request.headers().rsc === "1";
    if (!isRsc) return route.continue();
    if (!clicked || request.headers()["next-router-prefetch"] === "1") return route.abort();
    await blocked;
    return route.continue();
  });
  try {
    await page.goto("/ru");
    const cart = page.locator('nav[class*="bottomNav"]').getByRole("link", { name: "Корзина", exact: true });
    await expect(cart).toBeVisible();
    clicked = true;
    await cart.click({ noWaitAfter: true });
    await expect(cart.locator('[data-navigation-pending="true"]')).toBeAttached({ timeout: 500 });
  } finally {
    releaseRequest?.();
  }
  await expect(page).toHaveURL(/\/ru\/cart$/);
});

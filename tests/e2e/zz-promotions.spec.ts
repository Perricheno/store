import { expect, test } from "@playwright/test";
import sharp from "sharp";

// Runs after the checkout journey, which also rotates the bootstrap owner.
// Both passwords are public fixtures from the isolated E2E environment.
test("owner manages translated announcements and uploaded banners without a large mobile hero", async ({
  page,
  browser,
}) => {
  await page.goto("/staff");
  await page.getByLabel("Почта", { exact: true }).fill("owner@urbanmag.test");
  await page
    .getByLabel("Пароль", { exact: true })
    .fill("Owner-permanent-password-2026!");
  const login = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/staff/auth/login") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  if ((await login).status() === 401) {
    await page
      .getByLabel("Пароль", { exact: true })
      .fill("E2e-owner-password-2026!");
    const fallback = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/staff/auth/login") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    expect((await fallback).ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", { name: "Смените временный пароль" }),
    ).toBeVisible();
    await page
      .getByLabel("Пароль", { exact: true })
      .fill("E2e-owner-password-2026!");
    await page
      .getByLabel("Новый пароль, от 12 символов", { exact: true })
      .fill("Owner-permanent-password-2026!");
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Рабочее пространство" }),
  ).toBeVisible();
  const originalResponse = await page.request.get("/api/staff/settings");
  expect(originalResponse.ok()).toBeTruthy();
  const original = await originalResponse.json();
  const headers = { Origin: "https://localhost:3443" };
  const text = {
    ru: "Получение в магазине",
    kk: "Дүкеннен алу",
    en: "Collect in store",
  };
  const titles = {
    ru: "Новая коллекция",
    kk: "Жаңа топтама",
    en: "New collection",
  };
  try {
    await page.getByRole("button", { name: "Настройки", exact: true }).click();
    const announcement = page.getByRole("group", {
      name: "Объявление",
      exact: true,
    });
    const banner = page.getByRole("group", { name: "Баннер", exact: true });
    await announcement.getByRole("checkbox").check();
    await banner.getByRole("checkbox").check();
    for (const locale of ["ru", "kk", "en"] as const) {
      await announcement
        .locator(`input[name="announcement_${locale}"]`)
        .fill(text[locale]);
      await banner
        .locator(`input[name="banner_${locale}"]`)
        .fill(titles[locale]);
    }
    await announcement
      .locator('input[name="announcementHref"]')
      .fill("/ru/c/t-shirts");
    await banner.locator('input[name="bannerHref"]').fill("/ru/c/shoes");
    const png = await sharp({
      create: { width: 320, height: 160, channels: 3, background: "#e60012" },
    })
      .png()
      .toBuffer();
    const upload = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/staff/uploads") &&
        response.request().method() === "POST",
    );
    await banner
      .locator('input[type="file"]')
      .setInputFiles({
        name: "promotion.png",
        mimeType: "image/png",
        buffer: png,
      });
    const uploadResponse = await upload;
    expect(uploadResponse.ok()).toBeTruthy();
    const { url } = await uploadResponse.json();
    expect(url).toMatch(/^\/api\/media\/[a-f0-9]{64}\.webp$/);
    await expect(banner.locator("img")).toHaveAttribute("src", url);
    const about = {
      ru: "Команда магазина Urbanmag",
      kk: "Urbanmag дүкенінің командасы",
      en: "The Urbanmag store team",
    };
    await page.getByText("Страницы", { exact: true }).click();
    const editor = page.locator("details", {
      has: page.getByText("Страницы", { exact: true }),
    });
    await editor.getByRole("combobox").selectOption("about");
    for (const locale of ["ru", "kk", "en"] as const) {
      await editor
        .locator(`textarea[name="content_about_${locale}"]`)
        .fill(about[locale]);
    }
    const save = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/staff/settings") &&
        response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    expect((await save).ok()).toBeTruthy();

    const animated = await page.context().newPage();
    try {
      await animated.goto("/ru");
      const strip = animated.getByRole("complementary", {
        name: text.ru,
        exact: true,
      });
      const pause = strip.getByRole("button", {
        name: "Остановить бегущую строку",
        exact: true,
      });
      await pause.click();
      await expect(
        strip.getByRole("button", {
          name: "Продолжить бегущую строку",
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(strip.locator('span[class*="track"]')).toHaveCSS(
        "animation-play-state",
        "paused",
      );
      await strip
        .getByRole("button", { name: "Продолжить бегущую строку", exact: true })
        .click();
      await animated.locator("h1").click();
      await expect(strip.locator('span[class*="track"]')).toHaveCSS(
        "animation-play-state",
        "running",
      );
      await animated.emulateMedia({ reducedMotion: "reduce" });
      await expect(strip.locator('span[class*="track"]')).toHaveCSS(
        "animation-name",
        "none",
      );
    } finally {
      await animated.close();
    }

    // Disable JavaScript to prove the storefront renders saved content on the server.
    const storefront = await browser.newContext({
      ignoreHTTPSErrors: true,
      javaScriptEnabled: false,
      viewport: { width: 360, height: 800 },
      storageState: await page.context().storageState(),
    });
    try {
      const shop = await storefront.newPage();
      for (const locale of ["ru", "kk", "en"] as const) {
        await shop.goto(`https://localhost:3443/${locale}`);
        const notice = shop.getByRole("link", {
          name: text[locale],
          exact: true,
        });
        const promotion = shop.getByRole("link", {
          name: titles[locale],
          exact: true,
        });
        await expect(notice).toBeVisible();
        await expect(promotion).toBeVisible();
        await expect(notice).toHaveAttribute("href", "/ru/c/t-shirts");
        await expect(promotion).toHaveAttribute("href", "/ru/c/shoes");
        await expect(promotion.locator("img")).toHaveAttribute("src", url);
        const noticeBox = await notice.boundingBox();
        const bannerBox = await promotion.boundingBox();
        expect(noticeBox!.height).toBeGreaterThanOrEqual(44);
        expect(bannerBox!.height).toBeGreaterThanOrEqual(44);
        expect(bannerBox!.height).toBeLessThanOrEqual(160);
        expect(
          await shop.evaluate(() => document.documentElement.scrollWidth),
        ).toBe(360);
        await expect(shop.locator("footer")).toBeHidden();
        await shop.goto(`https://localhost:3443/${locale}/account`);
        const footerBox = await shop.locator("footer").boundingBox();
        expect(footerBox!.y).toBeGreaterThanOrEqual(800);
        for (const infoPage of [
          "contacts",
          "about",
          "delivery",
          "returns",
          "privacy",
          "terms",
        ]) {
          await expect(
            shop.locator(`footer a[href="/${locale}/${infoPage}"]`),
          ).toBeVisible();
        }
        await shop.locator(`footer a[href="/${locale}/about"]`).click();
        await expect(shop).toHaveURL(new RegExp(`/${locale}/about$`));
        await expect(
          shop.getByText(about[locale], { exact: true }),
        ).toBeVisible();
      }
    } finally {
      await storefront.close();
    }
    await banner
      .getByRole("button", { name: "Удалить изображение", exact: true })
      .click();
    await expect(banner.locator("img")).toHaveCount(0);
    const removed = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/staff/settings") &&
        response.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    expect((await removed).ok()).toBeTruthy();
    const withoutImage = await (
      await page.request.get("/api/staff/settings")
    ).json();
    expect(withoutImage.banner.imageUrl).toBeUndefined();
    const disabled = await page.request.patch("/api/staff/settings", {
      headers,
      data: {
        ...withoutImage,
        announcement: { ...withoutImage.announcement, enabled: false },
        banner: { ...withoutImage.banner, enabled: false },
      },
    });
    expect(disabled.ok()).toBeTruthy();
    await page.goto("/ru");
    await expect(
      page.getByRole("complementary", {
        name: "Объявления магазина",
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    const restored = await page.request.patch("/api/staff/settings", {
      headers,
      data: original,
    });
    expect(restored.ok()).toBeTruthy();
  }
});

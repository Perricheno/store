import { expect, test } from "@playwright/test";

const password = "Urbanmag-public-dev-gate-test-password";
test("development password creates a persistent host-only cookie without signing into an account", async ({ page, context }) => {
  const denied = await page.request.get("/api/dev-access/check");
  expect(denied.status()).toBe(401);
  await page.goto("/api/dev-access/login?lang=en&next=%2Fen%3Fgate%3D1%26sort%3Dprice");
  await expect(page.getByRole("heading", { name: "Development access" })).toBeVisible();
  await page.getByLabel("Access password").fill(password);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/en\?gate=1&sort=price$/);
  const cookie = (await context.cookies()).find(c => c.name === "__Host-urbanmag_dev_access");
  expect(cookie).toMatchObject({ domain: "localhost", path: "/", secure: true, httpOnly: true, sameSite: "Lax" });
  expect(cookie!.expires - Date.now() / 1000).toBeGreaterThan(29 * 86400);
  expect((await page.request.get("/api/dev-access/check")).status()).toBe(204);
  // A new browser session can restore the persistent cookie.
  const restored = await page.context().browser()!.newContext({ ignoreHTTPSErrors: true, storageState: await context.storageState() });
  expect((await restored.request.get("https://localhost:3443/api/dev-access/check")).status()).toBe(204);
  await restored.close();
});

test("development gate rejects bad credentials, foreign origins, unsafe redirects and tampered cookies", async ({ request }) => {
  const bad = await request.post("/api/dev-access/login?lang=en", { headers: { Origin: "https://localhost:3443" }, form: { password: "incorrect" } });
  expect(bad.status()).toBe(401);
  expect(await bad.text()).toContain("Incorrect password");
  const foreign = await request.post("/api/dev-access/login", { headers: { Origin: "https://attacker.invalid" }, form: { password } });
  expect(foreign.status()).toBe(403);
  for (const next of ["https://attacker.invalid/", "//attacker.invalid/", "/\\attacker.invalid", "/api/dev-access/login"]) {
    const result = await request.post("/api/dev-access/login", { headers: { Origin: "https://localhost:3443" }, form: { password, next }, maxRedirects: 0 });
    expect(result.status()).toBe(303);
    expect(result.headers().location).toBe("/");
  }
  const tampered = await request.get("/api/dev-access/check", { headers: { Cookie: "__Host-urbanmag_dev_access=invalid" } });
  expect(tampered.status()).toBe(401);
});

test("gate form supports all storefront languages and preserves original query strings", async ({ page }) => {
  for (const [lang, title] of [["ru", "Доступ к тестовой версии"], ["kk", "Сынақ нұсқасына кіру"], ["en", "Development access"]]) {
    await page.goto(`/api/dev-access/login?lang=${lang}&next=/en?q=bag&sort=price`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.locator('input[name="next"]')).toHaveValue("/en?q=bag&sort=price");
  }
});

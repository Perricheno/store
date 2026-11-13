#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';

const origin = new URL(process.argv[2] || 'https://dev-u.perricheno.com').origin;
const passwordFile = process.env.URBANMAG_DEV_GATE_PASSWORD_FILE;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
const page = await context.newPage();
const errors = [];
const failures = [];
let cloudflarePrefetchMisses = 0;
let documents = 0;
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (request.resourceType() === 'document') documents++;
});
page.on('response', response => {
  if (response.status() < 500) return;
  const request = response.request();
  // Speed Brain serves speculative HTML only from cache; its documented cache
  // miss is 503. RSC requests and actual document failures must still fail.
  if (response.status() === 503 && response.headers().server === 'cloudflare' &&
      request.resourceType() === 'other' && !request.headers().rsc &&
      request.headers()['sec-purpose'] === 'prefetch') {
    cloudflarePrefetchMisses++;
    return;
  }
  failures.push({ path: new URL(response.url()).pathname, status: response.status() });
});

try {
  if (passwordFile) {
    const login = await context.request.post(`${origin}/api/dev-access/login`, {
      headers: { Origin: origin },
      form: { password: readFileSync(passwordFile, 'utf8').trim(), next: '/ru' },
      maxRedirects: 0,
    });
    expect(login.status()).toBe(303);
  }
  expect((await context.request.get(`${origin}/api/health`)).status()).toBe(200);
  const response = await page.goto(`${origin}/ru?q=City`);
  expect(response.status()).toBe(200);
  await expect(page.getByTestId('catalog-grid').locator('article').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Добавить в корзину:/ }).first()).toBeEnabled();
  const nav = page.locator('nav[class*="bottomNav"]');
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.__urbanmagEdgeNav = document.querySelector('nav[class*="bottomNav"]');
    window.__urbanmagEdgeTimeOrigin = performance.timeOrigin;
  });
  const before = await nav.evaluate(element => getComputedStyle(element).fontFamily);
  for (const path of ['/ru/cart', '/ru/favorites', '/ru/account', '/ru']) {
    const link = nav.locator(`a[href="${path}"]`);
    await link.click();
    await expect(page).toHaveURL(`${origin}${path}`);
    await expect(link).toHaveAttribute('aria-current', 'page');
    expect(await nav.evaluate(element => element === window.__urbanmagEdgeNav &&
      performance.timeOrigin === window.__urbanmagEdgeTimeOrigin)).toBe(true);
    expect(await nav.evaluate(element => getComputedStyle(element).fontFamily)).toBe(before);
  }
  expect(documents).toBe(1);
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  console.log(JSON.stringify({ origin, transitions: 4, documents, persistentNavigation: true,
    fontUnchanged: true, errors, failures, cloudflarePrefetchMisses }, null, 2));
} finally {
  await context.close();
  await browser.close();
}

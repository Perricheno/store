export const locales = ['ru', 'kk', 'en'] as const;
export type Locale = typeof locales[number];
export function isLocale(value: string): value is Locale { return locales.includes(value as Locale); }
export const shopOrigin = () => process.env.APP_URL || process.env.SHOP_ORIGIN || 'http://localhost:3000';
export const staffOrigin = () => process.env.STAFF_URL || process.env.STAFF_ORIGIN || 'http://localhost:3000';
export function checkoutEnabled() {
  if (process.env.APP_ENV !== 'production' && process.env.APIPAY_MODE === 'mock') return true;
  return !!(process.env.APIPAY_API_KEY && process.env.APIPAY_WEBHOOK_SECRET && process.env.SMTP_URL && process.env.MAIL_FROM);
}
export function indexingEnabled() {
  const host = new URL(shopOrigin()).hostname;
  return process.env.APP_ENV === 'production' && process.env.SEO_INDEXING_ENABLED === 'true' && !host.endsWith('perricheno.com') && !['localhost','127.0.0.1'].includes(host);
}
export function isLocalHost(host: string) { return ['localhost','127.0.0.1','[::1]','urbanmag.test','staff.urbanmag.test'].includes(host.split(':')[0]); }

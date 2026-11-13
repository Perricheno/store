import type { Metadata } from 'next';
import './globals.css';
import { headers } from 'next/headers';

export const metadata: Metadata = {
  title: { default: 'Urbanmag — одежда и кроссовки', template: '%s — Urbanmag' },
  description: 'Одежда и кроссовки Urbanmag. Самовывоз в Жезказгане.',
  robots: { index: false, follow: true },
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await headers()).get('x-urbanmag-locale') || 'ru';
  return <html lang={locale} data-scroll-behavior="smooth"><body>{children}</body></html>;
}

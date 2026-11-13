import { notFound } from "next/navigation";
import { getSettings } from "@urbanmag/core";
import { CartView } from "@/components/shop";
import { isLocale } from "@/lib/config";
import { initialCart } from "@/lib/server-cart";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [settings, cart] = await Promise.all([getSettings(), initialCart()]);
  return <CartView locale={locale} settings={settings} initialCart={cart} />;
}

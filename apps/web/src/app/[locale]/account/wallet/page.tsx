import { notFound } from "next/navigation";
import { shopSettings as getSettings } from "@/lib/server-settings";
import { WalletView } from "@/components/shop-wallet";
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
  return <WalletView locale={locale} settings={settings} initialCart={cart} />;
}

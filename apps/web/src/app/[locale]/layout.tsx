import { notFound } from "next/navigation";
import { ShopShell } from "@/components/shop-shell";
import { isLocale } from "@/lib/config";
import { initialCart } from "@/lib/server-cart";
import { shopSettings } from "@/lib/server-settings";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [settings, cart] = await Promise.all([shopSettings(), initialCart()]);
  return <ShopShell locale={locale} settings={settings} initialCart={cart}>{children}</ShopShell>;
}

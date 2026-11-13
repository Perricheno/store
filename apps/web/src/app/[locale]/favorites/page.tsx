import { notFound } from "next/navigation";
import { getSettings } from "@urbanmag/core";
import { Storefront } from "@/components/shop";
import { isLocale } from "@/lib/config";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <Storefront
      locale={locale}
      products={[]}
      settings={await getSettings()}
      favoritesOnly
    />
  );
}

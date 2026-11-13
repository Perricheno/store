import { notFound } from "next/navigation";
import { getSettings } from "@urbanmag/core";
import { AccountView } from "@/components/shop";
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
  return <AccountView locale={locale} settings={await getSettings()} />;
}

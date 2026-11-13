import { notFound } from "next/navigation";
import { isLocale } from "@/lib/config";
import { Recovery } from "@/recovery/recovery";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Recovery locale={locale} />;
}

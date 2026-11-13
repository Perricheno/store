import { notFound } from "next/navigation";
import { getSettings } from "@urbanmag/core";
import { StoreInformation } from "@/components/shop-information";
import { isLocale } from "@/lib/config";
import { dictionary } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
const pages = [
  "contacts",
  "about",
  "delivery",
  "returns",
  "privacy",
  "terms",
] as const;
type InfoPage = (typeof pages)[number];
function isInfoPage(value: string): value is InfoPage {
  return pages.includes(value as InfoPage);
}
type Props = { params: Promise<{ locale: string; infoPage: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale, infoPage } = await params;
  if (!isLocale(locale) || !isInfoPage(infoPage)) return {};
  const t = dictionary(locale);
  const title = {
    contacts: t.contacts,
    about: t.footerAbout,
    delivery: t.footerDelivery,
    returns: t.footerReturns,
    privacy: t.footerPrivacy,
    terms: t.footerTerms,
  }[infoPage];
  return pageMetadata(locale, title, `${title} — Urbanmag`, `/${infoPage}`);
}
export default async function Page({ params }: Props) {
  const { locale, infoPage } = await params;
  if (!isLocale(locale) || !isInfoPage(infoPage)) notFound();
  const settings = await getSettings();
  return (
    <StoreInformation locale={locale} infoPage={infoPage} settings={settings} />
  );
}

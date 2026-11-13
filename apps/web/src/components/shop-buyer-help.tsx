"use client";
import Link from "next/link";
import { dictionary } from "../lib/i18n";
import type { Common } from "./shop-types";
import { actualContact, ContactDetails } from "./shop-shell";
import { buyerCopy } from "./buyer-copy";
import s from "./shop-buyer.module.css";
export function BuyerHelp({ locale, settings }: Common) {
  const copy = buyerCopy[locale], t = dictionary(locale);
  const contact = [settings?.phone, settings?.email, settings?.pickupAddress || settings?.address, settings?.pickupHours].some((value) => actualContact(value, locale));
  return <section className={s.section} id="help"><h2>{copy.help}</h2><p>{copy.helpHint}</p>
    {contact ? <ContactDetails locale={locale} settings={settings} /> : <p>{copy.noContacts}</p>}
    <p>{copy.guestOrder}</p><nav className={s.links} aria-label={copy.help}>
      <Link href={`/${locale}/delivery`} prefetch={false}>{t.footerDelivery}</Link>
      <Link href={`/${locale}/returns`} prefetch={false}>{t.footerReturns}</Link>
      <Link href={`/${locale}/contacts`} prefetch={false}>{t.contacts}</Link>
    </nav>
  </section>;
}

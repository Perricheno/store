"use client";

import { dictionary } from "../lib/i18n";
import s from "./shop.module.css";
import { type Common } from "./shop-types";
import { localized } from "./shop-client";
import { ShopShell, ContactDetails } from "./shop-shell";

export function StoreInformation({
  locale,
  settings,
  infoPage,
}: Common & {
  infoPage: "contacts" | "about" | "delivery" | "returns" | "privacy" | "terms";
}) {
  const t = dictionary(locale);
  const title = {
    contacts: t.contacts,
    about: t.footerAbout,
    delivery: t.footerDelivery,
    returns: t.footerReturns,
    privacy: t.footerPrivacy,
    terms: t.footerTerms,
  }[infoPage];
  const body =
    infoPage === "contacts"
      ? ""
      : localized(settings?.contentPages?.[infoPage], locale).trim();
  return (
    <ShopShell locale={locale} settings={settings}>
      <article className={s.informationPage}>
        <h1>
          {title}
          <span className={s.titleDot}>.</span>
        </h1>
        {infoPage === "contacts" ? (
          <ContactDetails locale={locale} settings={settings} />
        ) : (
          body && <div className={s.informationBody}>{body}</div>
        )}
      </article>
    </ShopShell>
  );
}

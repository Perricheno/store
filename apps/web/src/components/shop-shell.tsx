"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, ViewTransition, type ReactNode } from "react";
import {
  ArrowRight,
  Bag,
  Globe,
  Heart,
  MagnifyingGlass,
  MapPin,
  User,
  SquaresFour,
} from "@phosphor-icons/react";
import { dictionary, type Locale } from "../lib/i18n";
import { InstallApp } from "./install-app";
import { StoreAnnouncement } from "./shop-announcement";
import s from "./shop.module.css";
import { type Common } from "./shop-types";
import { useCart, localized, pickupAddress, pickupHours } from "./shop-client";

export function StoreHeader({ locale, initialCart }: Common) {
  const t = dictionary(locale);
  const path = usePathname();
  const [q, setQ] = useState("");
  const { cart } = useCart(initialCart);
  useEffect(() => {
    setQ(new URLSearchParams(window.location.search).get("q") || "");
  }, [path]);
  return (
    <>
      <a className={s.skip} href="#main">
        {t.skip}
      </a>
      <header className={s.header}>
        <div className={s.headerInner}>
          <Link
            prefetch={false}
            className={s.logo}
            href={`/${locale}`}
            aria-label="URBANMAG"
          >
            <span aria-hidden="true">
              URBAN<span className={s.logoSlash}>/</span>
            </span>
            <span aria-hidden="true">
              MAG<span className={s.logoDot}>●</span>
            </span>
          </Link>
          <nav className={s.desktopNav} aria-label={t.catalog}>
            <Link prefetch={false} href={`/${locale}`}>
              {t.new}
            </Link>
            <Link prefetch={false} href={`/${locale}?gender=men`}>
              {t.men}
            </Link>
            <Link prefetch={false} href={`/${locale}?gender=women`}>
              {t.women}
            </Link>
          </nav>
          <form className={s.headerSearch} action={`/${locale}`}>
            <MagnifyingGlass size={20} weight="bold" />
            <input
              aria-label={t.search}
              name="q"
              placeholder={t.searchPlaceholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" aria-label={t.search}>
              <ArrowRight size={19} weight="bold" />
            </button>
          </form>
          <div className={s.headerActions}>
            <div
              className={`${s.languages} ${s.desktopLanguages}`}
              aria-label={t.language}
            >
              {(["ru", "kk", "en"] as Locale[]).map((l) => (
                <a
                  key={l}
                  href={path.replace(/^\/(ru|kk|en)(?=\/|\?|$)/, `/${l}`)}
                  hrefLang={l}
                  onClick={(e) => {
                    e.currentTarget.href = (
                      window.location.pathname + window.location.search
                    ).replace(/^\/(ru|kk|en)(?=\/|\?|$)/, `/${l}`);
                  }}
                  aria-current={locale === l ? "true" : undefined}
                >
                  {l.toUpperCase()}
                </a>
              ))}
            </div>
            <div className={s.languageControl}>
              <Globe size={24} weight="bold" aria-hidden="true" />
              <span aria-hidden="true">{locale.toUpperCase()}</span>
              <select
                className={s.mobileLanguage}
                aria-label={t.language}
                value={locale}
                onChange={(event) => {
                  window.location.href = (
                    window.location.pathname + window.location.search
                  ).replace(
                    /^\/(ru|kk|en)(?=\/|\?|$)/,
                    `/${event.target.value}`,
                  );
                }}
              >
                <option value="ru">RU</option>
                <option value="kk">KK</option>
                <option value="en">EN</option>
              </select>
            </div>
            <Link
              prefetch={false}
              href={`/${locale}/favorites`}
              className={s.iconButton}
              aria-label={t.favorites}
            >
              <Heart size={23} weight="bold" />
            </Link>
            <Link
              prefetch={false}
              href={`/${locale}/account`}
              className={`${s.iconButton} ${s.accountIcon}`}
              aria-label={t.account}
            >
              <User size={23} weight="bold" />
            </Link>
            <Link
              prefetch={false}
              href={`/${locale}/cart`}
              className={s.iconButton}
              aria-label={`${t.cart}${cart.items.length ? ` (${cart.items.reduce((n, i) => n + i.quantity, 0)})` : ""}`}
            >
              <Bag size={24} weight="bold" />
              {cart.items.length > 0 && (
                <span className={s.cartDot}>
                  {cart.items.reduce((n, i) => n + i.quantity, 0)}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>
      <nav className={s.bottomNav} aria-label={t.catalog}>
        {[
          {
            href: `/${locale}`,
            label: t.catalog,
            icon: SquaresFour,
            active:
              path === `/${locale}` ||
              path.startsWith(`/${locale}/c/`) ||
              path.startsWith(`/${locale}/p/`),
          },
          {
            href: `/${locale}/favorites`,
            label: t.favorites,
            icon: Heart,
            active: path.endsWith("/favorites"),
          },
          {
            href: `/${locale}/cart`,
            label: t.cart,
            icon: Bag,
            active: path.endsWith("/cart") || path.endsWith("/checkout"),
          },
          {
            href: `/${locale}/account`,
            label: t.account,
            icon: User,
            active: path.includes("/account"),
          },
        ].map(({ href, label, icon: NavIcon, active }) => (
          <Link
            key={href}
            href={href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            aria-label={
              href.endsWith("/cart") && cart.items.length
                ? `${label} (${cart.items.reduce((total, item) => total + item.quantity, 0)})`
                : label
            }
          >
            <span className={s.navIcon}>
              <NavIcon size={25} weight="bold" />
              {href.endsWith("/cart") && cart.items.length > 0 && (
                <span className={s.cartDot}>
                  {cart.items.reduce((n, item) => n + item.quantity, 0)}
                </span>
              )}
            </span>
            <span>{href.endsWith("/account") ? t.profile : label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

export function actualContact(value: unknown, locale: Locale) {
  const text = localized(value, locale).trim();
  return /уточняется|to be confirmed|нақтылан/i.test(text) ? "" : text;
}

export function ContactDetails({ locale, settings }: Common) {
  const address = actualContact(
    settings?.pickupAddress || settings?.address,
    locale,
  );
  const hours = actualContact(settings?.pickupHours, locale);
  const phone = actualContact(settings?.phone, locale);
  const email = actualContact(settings?.email, locale);
  return (
    <div className={s.contactDetails}>
      {phone && <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{phone}</a>}
      {email && <a href={`mailto:${email}`}>{email}</a>}
      {address && (
        <p>
          <MapPin size={18} weight="bold" aria-hidden="true" />
          {address}
        </p>
      )}
      {hours && <p>{hours}</p>}
    </div>
  );
}

export function StoreFooter({ locale, settings }: Common) {
  const t = dictionary(locale);
  const path = usePathname();
  return (
    <footer
      className={s.footer}
      data-mobile-profile={path === `/${locale}/account`}
    >
      <div className={s.footerGroups}>
        <div className={s.footerIdentity}>
          <Link prefetch={false} className={s.footerLogo} href={`/${locale}`}>
            URBAN/MAG
          </Link>
          <ContactDetails locale={locale} settings={settings} />
        </div>
        <nav aria-label={t.footerCustomers}>
          <h2>{t.footerCustomers}</h2>
          {[
            ["contacts", t.contacts],
            ["about", t.footerAbout],
            ["delivery", t.footerDelivery],
            ["returns", t.footerReturns],
          ].map(([path, label]) => (
            <Link key={path} prefetch={false} href={`/${locale}/${path}`}>
              {label}
            </Link>
          ))}
        </nav>
        <nav aria-label={t.footerLegal}>
          <h2>{t.footerLegal}</h2>
          {[
            ["privacy", t.footerPrivacy],
            ["terms", t.footerTerms],
            ["cookies", t.cookies],
          ].map(([path, label]) => (
            <Link key={path} prefetch={false} href={`/${locale}/${path}`}>
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className={s.footerBottom}>
        <span>© {new Date().getFullYear()} URBANMAG</span>
      </div>
    </footer>
  );
}

export function ShopShell({
  children,
  locale,
  settings,
  initialCart,
}: Common & { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className={s.shop}>
      <StoreAnnouncement locale={locale} settings={settings} />
      <StoreHeader locale={locale} initialCart={initialCart} />
      <ViewTransition
        name="shop-content"
        default="none"
        share="urbanmag-route"
        enter="urbanmag-route"
        exit="urbanmag-route"
      >
        <main id="main" className={s.main} key={path}>
          {children}
        </main>
      </ViewTransition>
      <InstallApp locale={locale} />
      <StoreFooter locale={locale} settings={settings} />
    </div>
  );
}

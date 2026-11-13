"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { dictionary, money, type Locale } from "../lib/i18n";
import s from "./shop.module.css";
import { type Cart } from "./shop-types";

export function Empty({
  title,
  hint,
  icon,
  children,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={s.empty}>
      {icon && <div className={s.emptyIcon}>{icon}</div>}
      <h2>{title}</h2>
      {hint && <p>{hint}</p>}
      {children}
    </div>
  );
}

export function ErrorNotice({
  text,
  action,
}: {
  text: string;
  action?: () => void;
}) {
  return (
    <p className={s.error} role="alert">
      {text}
      {action && (
        <button onClick={action}>
          <ArrowRight size={20} />
        </button>
      )}
    </p>
  );
}

export function PageTitle({
  title,
  aside,
  locale,
}: {
  title: string;
  aside?: ReactNode;
  locale: Locale;
}) {
  const t = dictionary(locale);
  return (
    <div className={s.pageTitle}>
      <div>
        <Link prefetch={false} className={s.backLink} href={`/${locale}`}>
          <ArrowLeft size={17} weight="bold" />
          {t.catalog}
        </Link>
        <h1>
          {title}
          <span className={s.titleDot}>.</span>
        </h1>
      </div>
      {aside}
    </div>
  );
}

export function CartSummary({
  cart,
  locale,
  children,
}: {
  cart: Cart;
  locale: Locale;
  children?: ReactNode;
}) {
  const t = dictionary(locale);
  return (
    <aside className={s.summary}>
      <p className={s.eyebrow}>URBANMAG / {t.order}</p>
      <h2>
        {t.total}
        <span>{money(cart.total, locale)}</span>
      </h2>
      <p className={s.summaryCount}>
        {cart.items.reduce((a, i) => a + i.quantity, 0)} {t.pieces}
      </p>
      {children}
    </aside>
  );
}

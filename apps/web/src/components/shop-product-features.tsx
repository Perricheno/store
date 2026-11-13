"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Plus } from "@phosphor-icons/react";
import type { Product } from "@urbanmag/core";
import { dictionary, type Locale } from "../lib/i18n";
import { localized, optimisticAddProductToCart } from "./shop-client";
import f from "./shop-product-features.module.css";

export function ProductPromotion({
  product,
  locale,
  overlay = false,
}: {
  product: Product;
  locale: Locale;
  overlay?: boolean;
}) {
  const promotion = product.promotion;
  const label = localized(promotion?.label, locale).trim();
  if (!promotion?.enabled || !label) return null;
  const percent = promotion.percent;
  const showPercent =
    typeof percent === "number" &&
    Number.isInteger(percent) &&
    percent >= 1 &&
    percent <= 99;
  return (
    <span className={`${f.promotion} ${overlay ? f.promotionOverlay : ""}`}>
      {label}
      {showPercent ? ` −${percent}%` : ""}
    </span>
  );
}

export function ProductSpecifications({
  product,
  locale,
}: {
  product: Product;
  locale: Locale;
}) {
  const meaningful = (value: string) =>
    Boolean(value.trim()) &&
    !/^(?:[-–—]|нет|жоқ|none|n\/a)$/i.test(value.trim());
  const details = (product.details || []).filter(
    (detail) =>
      detail.enabled &&
      meaningful(localized(detail.label, locale)) &&
      meaningful(localized(detail.value, locale)),
  );
  if (!details.length) return null;
  const title = {
    ru: "Характеристики",
    kk: "Сипаттамалары",
    en: "Specifications",
  }[locale];
  return (
    <section className={f.specifications}>
      <h2>{title}</h2>
      <dl>
        {details.map((detail) => (
          <div key={detail.key}>
            <dt>{localized(detail.label, locale).trim()}</dt>
            <dd>{localized(detail.value, locale).trim()}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// Retain the wrapper API used by storefront and buyer-history cards.
export function ProductQuickAddProvider({ children }: { children: ReactNode }) {
  return children;
}

export function ProductQuickAdd({
  product,
  locale,
}: {
  product: Product;
  locale: Locale;
}) {
  const t = dictionary(locale);
  const lock = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState(false);
  const available = product.sizes.filter((variant) => variant.available > 0);
  const name = localized(product.names, locale);
  useEffect(() => setReady(true), []);
  async function add() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setAdded(true);
    setError(false);
    try {
      await optimisticAddProductToCart(product);
    } catch {
      setAdded(false);
      setError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className={f.quickAdd}
        disabled={!ready || busy || !available.length}
        aria-label={`${added ? t.addedCart : available.length ? t.addCart : t.soldOut}: ${name}`}
        onClick={() => { void add(); }}
      >
        {added ? (
          <Check size={22} weight="bold" aria-hidden="true" />
        ) : (
          <Plus size={22} weight="bold" aria-hidden="true" />
        )}
      </button>
      {(error || added) && (
        <span className={error ? f.cardError : f.srOnly} role="status">
          {error ? t.cartError : t.addedCart}
        </span>
      )}
    </>
  );
}

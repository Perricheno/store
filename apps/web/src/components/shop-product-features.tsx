"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Plus, X } from "@phosphor-icons/react";
import type { Product } from "@urbanmag/core";
import { dictionary, type Locale } from "../lib/i18n";
import { localized, optimisticAddToCart } from "./shop-client";
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

type QuickAddSelection = {
  product: Product;
  locale: Locale;
  trigger: HTMLButtonElement;
  add: (variant: Product["sizes"][number]) => void;
};

const QuickAddContext = createContext<
  ((selection: QuickAddSelection) => void) | null
>(null);

export function ProductQuickAddProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<QuickAddSelection | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const open = useCallback((next: QuickAddSelection) => {
    trigger.current = next.trigger;
    setSelection(next);
  }, []);

  useEffect(() => {
    if (selection && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [selection]);

  function close() {
    dialog.current?.close();
    trigger.current?.focus();
  }

  const available =
    selection?.product.sizes.filter((variant) => variant.available > 0) ?? [];
  const t = selection ? dictionary(selection.locale) : null;
  return (
    <QuickAddContext.Provider value={open}>
      {children}
      <dialog
        ref={dialog}
        className={f.sizeDialog}
        aria-labelledby={titleId}
        onClose={() => {
          setSelection(null);
          trigger.current?.focus();
          trigger.current = null;
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        {selection && t && (
          <>
            <div className={f.dialogHead}>
              <h2 id={titleId}>{t.selectSize}</h2>
              <button type="button" aria-label={t.close} onClick={close}>
                <X size={22} aria-hidden="true" />
              </button>
            </div>
            <p className={f.dialogProduct}>
              {localized(selection.product.names, selection.locale)}
            </p>
            <div className={f.sizes}>
              {available.map((variant) => (
                <button
                  type="button"
                  key={variant.id}
                  onClick={() => {
                    close();
                    selection.add(variant);
                  }}
                >
                  {variant.size}
                  {available.some(
                    (other) =>
                      other.size === variant.size &&
                      other.color !== variant.color,
                  ) && <small>{variant.color}</small>}
                </button>
              ))}
            </div>
          </>
        )}
      </dialog>
    </QuickAddContext.Provider>
  );
}

export function ProductQuickAdd({
  product,
  locale,
}: {
  product: Product;
  locale: Locale;
}) {
  const t = dictionary(locale);
  const open = useContext(QuickAddContext);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState(false);
  const available = product.sizes.filter((variant) => variant.available > 0);
  const name = localized(product.names, locale);
  async function add(variant: Product["sizes"][number]) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setAdded(true);
    setError(false);
    try {
      await optimisticAddToCart(product, variant);
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
        disabled={busy || !available.length}
        aria-label={`${added ? t.addedCart : available.length ? t.addCart : t.soldOut}: ${name}`}
        aria-haspopup={available.length > 1 ? "dialog" : undefined}
        onClick={(event) => {
          if (lock.current) return;
          setError(false);
          if (available.length === 1) void add(available[0]);
          else if (available.length > 1)
            open?.({ product, locale, trigger: event.currentTarget, add });
        }}
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

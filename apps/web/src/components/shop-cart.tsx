"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bag, MapPin, Minus, Plus } from "@phosphor-icons/react";
import { dictionary, money } from "../lib/i18n";
import s from "./shop.module.css";
import c from "./shop-cart.module.css";
import { type Common } from "./shop-types";
import {
  useCart,
  optimisticCartQuantity,
  optimisticCartSize,
  pickupAddress,
} from "./shop-client";
import { PageTitle, Empty, ErrorNotice, CartSummary } from "./shop-ui";
import { ProductMedia } from "./shop-media";

export function CartView({ locale, settings, initialCart }: Common) {
  const t = dictionary(locale);
  const { cart, loading, error, refresh } = useCart(initialCart);
  const [busy, setBusy] = useState(""),
    [updateError, setUpdateError] = useState(false);
  const busyRef = useRef(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const chooseSize = {
    ru: "Выберите размер",
    kk: "Өлшемді таңдаңыз",
    en: "Choose a size",
  }[locale];
  const insufficientStock = {
    ru: "Недостаточно товара",
    kk: "Тауар жеткіліксіз",
    en: "Not enough stock",
  }[locale];
  const sizesRequired = cart.items.some((item) => !item.variantId);
  async function selectSize(lineKey: string, variantId: string) {
    if (!variantId || busyRef.current) return;
    busyRef.current = true;
    setBusy(lineKey);
    try {
      await optimisticCartSize(lineKey, variantId);
      setUpdateError(false);
    } catch {
      setUpdateError(true);
    } finally {
      busyRef.current = false;
      setBusy("");
    }
  }
  async function update(variantId: string, quantity: number) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(variantId);
    try {
      await optimisticCartQuantity(variantId, quantity);
      setUpdateError(false);
    } catch {
      setUpdateError(true);
    } finally {
      busyRef.current = false;
      setBusy("");
    }
  }
  return (
    <>
      <section className={s.innerPage}>
        <PageTitle
          title={t.cart}
          locale={locale}
          aside={
            <span className={s.pageCounter}>
              {cart.items
                .reduce((a, i) => a + i.quantity, 0)
                .toString()
                .padStart(2, "0")}
            </span>
          }
        />
        {loading ? (
          <div className={s.loading}>{t.loading}</div>
        ) : error ? (
          <Empty title={t.error}>
            <button onClick={refresh} className={s.primaryButton}>
              {t.retry}
            </button>
          </Empty>
        ) : !cart.items.length ? (
          <Empty
            title={t.cartEmpty}
            hint={t.cartHint}
            icon={<Bag size={44} weight="bold" />}
          >
            <Link
              prefetch={false}
              href={`/${locale}`}
              className={s.primaryButton}
            >
              {t.toCatalog}
              <ArrowRight size={21} />
            </Link>
          </Empty>
        ) : (
          <div className={s.cartLayout}>
            <div className={s.cartItems}>
              {updateError && <ErrorNotice text={t.cartError} />}{" "}
              {cart.items.map((item) => (
                <article className={s.cartItem} key={item.variantId ?? item.product.id}>
                  <Link
                    prefetch={false}
                    className={s.cartImage}
                    href={`/${locale}/p/${item.product.slug}`}
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <ProductMedia product={item.product} locale={locale} />
                  </Link>
                  <div className={s.cartItemInfo}>
                    {!(
                      item.product.isDemo &&
                      item.product.brand.toUpperCase() === "DEMO"
                    ) && <p className={s.brand}>{item.product.brand}</p>}
                    <Link
                      prefetch={false}
                      className={s.cartProductName}
                      href={`/${locale}/p/${item.product.slug}`}
                    >
                      {item.product.names[locale] || item.product.names.ru}
                    </Link>
                    <div className={c.sizeRow}>
                      <label className={c.sizeField}>
                        <span className={!item.variantId ? c.warning : undefined}>
                          {!item.variantId && <span className={c.warningIcon} aria-hidden="true">!</span>}
                          <span>{!item.variantId ? chooseSize : t.size}</span>
                        </span>
                        <select
                          aria-label={`${t.size}: ${item.product.names[locale] || item.product.names.ru}`}
                          value={item.variantId ?? ""}
                          disabled={!ready || Boolean(busy)}
                          onChange={(event) => void selectSize(item.variantId ?? item.product.id, event.target.value)}
                        >
                          {!item.variantId && <option value="" disabled>{chooseSize}</option>}
                          {item.product.sizes.map((variant) => {
                            const other = cart.items.find((line) => line.variantId === variant.id && line !== item);
                            const targetQuantity = item.quantity + (other?.quantity ?? 0);
                            const unavailable = targetQuantity > variant.available || targetQuantity > 50;
                            const duplicateSize = item.product.sizes.some((v) => v.id !== variant.id && v.size === variant.size);
                            return <option key={variant.id} value={variant.id} disabled={unavailable}>
                              {variant.size}{duplicateSize ? ` · ${variant.color}` : ""}{unavailable ? ` · ${variant.available === 0 ? t.soldOut : insufficientStock}` : ""}
                            </option>;
                          })}
                        </select>
                      </label>
                      <strong className={s.cartMobilePrice}>{money(item.product.price * item.quantity, locale)}</strong>
                    </div>
                    <div className={s.cartControls}>
                      <div className={s.quantity}>
                        <button
                          disabled={!ready || Boolean(busy) || item.quantity <= 1}
                          onClick={() =>
                            update(item.variantId ?? item.product.id, item.quantity - 1)
                          }
                          aria-label={t.decrease}
                        >
                          <Minus size={16} weight="bold" />
                        </button>
                        <span aria-live="polite">{item.quantity}</span>
                        <button
                          disabled={
                            !ready ||
                            Boolean(busy) ||
                            item.quantity >= 50 ||
                            cart.items.filter((line) => line.product.id === item.product.id).reduce((sum, line) => sum + line.quantity, 0) >= item.product.sizes.reduce((sum, v) => sum + v.available, 0) ||
                            item.quantity >=
                              (item.product.sizes.find(
                                (v) => v.id === item.variantId,
                              )?.available ?? item.product.sizes.reduce((sum, v) => sum + v.available, 0))
                          }
                          onClick={() =>
                            update(item.variantId ?? item.product.id, item.quantity + 1)
                          }
                          aria-label={t.increase}
                        >
                          <Plus size={16} weight="bold" />
                        </button>
                      </div>
                      <button
                        className={s.removeButton}
                        disabled={!ready || Boolean(busy)}
                        onClick={() => update(item.variantId ?? item.product.id, 0)}
                      >
                        {t.remove}
                      </button>
                    </div>
                  </div>
                  <strong className={s.cartLinePrice}>
                    {money(item.product.price * item.quantity, locale)}
                  </strong>
                </article>
              ))}
            </div>
            <CartSummary cart={cart} locale={locale}>
              {sizesRequired ? (
                <>
                  <p className={c.warning} role="status"><span className={c.warningIcon} aria-hidden="true">!</span>{chooseSize}</p>
                  <button type="button" className={s.primaryButton} disabled>{t.checkout}<ArrowRight size={22} weight="bold" /></button>
                </>
              ) : (
                <Link prefetch={false} href={`/${locale}/checkout`} className={s.primaryButton}>
                  {t.checkout}<ArrowRight size={22} weight="bold" />
                </Link>
              )}
              <p className={s.summaryNote}>
                <MapPin size={17} />
                {t.pickup} · {pickupAddress(settings, locale)}
              </p>
            </CartSummary>
          </div>
        )}
      </section>
    </>
  );
}

"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, Bag, MapPin, Minus, Plus } from "@phosphor-icons/react";
import { dictionary, money } from "../lib/i18n";
import s from "./shop.module.css";
import { type Common } from "./shop-types";
import { useCart, optimisticCartQuantity, pickupAddress } from "./shop-client";
import { ShopShell } from "./shop-shell";
import { PageTitle, Empty, ErrorNotice, CartSummary } from "./shop-ui";
import { ProductMedia } from "./shop-media";

export function CartView({ locale, settings, initialCart }: Common) {
  const t = dictionary(locale);
  const { cart, loading, error, refresh } = useCart(initialCart);
  const [busy, setBusy] = useState(""),
    [updateError, setUpdateError] = useState(false);
  const busyRef = useRef(false);
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
    <ShopShell locale={locale} settings={settings} initialCart={initialCart}>
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
                <article className={s.cartItem} key={item.variantId}>
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
                    <p className={s.cartSize}>
                      {t.size}: {item.size}
                      <strong className={s.cartMobilePrice}>
                        {money(item.product.price * item.quantity, locale)}
                      </strong>
                    </p>
                    <div className={s.cartControls}>
                      <div className={s.quantity}>
                        <button
                          disabled={Boolean(busy) || item.quantity <= 1}
                          onClick={() =>
                            update(item.variantId, item.quantity - 1)
                          }
                          aria-label={t.decrease}
                        >
                          <Minus size={16} weight="bold" />
                        </button>
                        <span aria-live="polite">{item.quantity}</span>
                        <button
                          disabled={
                            Boolean(busy) ||
                            item.quantity >=
                              (item.product.sizes.find(
                                (v) => v.id === item.variantId,
                              )?.available ?? 999)
                          }
                          onClick={() =>
                            update(item.variantId, item.quantity + 1)
                          }
                          aria-label={t.increase}
                        >
                          <Plus size={16} weight="bold" />
                        </button>
                      </div>
                      <button
                        className={s.removeButton}
                        disabled={Boolean(busy)}
                        onClick={() => update(item.variantId, 0)}
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
              <Link
                prefetch={false}
                href={`/${locale}/checkout`}
                className={s.primaryButton}
              >
                {t.checkout}
                <ArrowRight size={22} weight="bold" />
              </Link>
              <p className={s.summaryNote}>
                <MapPin size={17} />
                {t.pickup} · {pickupAddress(settings, locale)}
              </p>
            </CartSummary>
          </div>
        )}
      </section>
    </ShopShell>
  );
}

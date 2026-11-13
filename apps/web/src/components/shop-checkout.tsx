"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, MapPin } from "@phosphor-icons/react";
import { dictionary, money } from "../lib/i18n";
import s from "./shop.module.css";
import { type Common, type Order } from "./shop-types";
import {
  useCart,
  awaitCartMutations,
  request,
  post,
  cartChanged,
  statusLabel,
  pickupAddress,
  pickupHours,
} from "./shop-client";
import { ShopShell } from "./shop-shell";
import { ErrorNotice, PageTitle, Empty, CartSummary } from "./shop-ui";

export function CheckoutView({ locale, settings, initialCart }: Common) {
  const t = dictionary(locale);
  const { cart, loading, error, refresh } = useCart(initialCart);
  const [ready, setReady] = useState<boolean | null>(null);
  const [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState(""),
    [order, setOrder] = useState<Order | null>(null);
  const idempotency = useRef("");
  const submitting = useRef(false);
  useEffect(() => {
    request<{ checkoutEnabled: boolean }>("/api/settings")
      .then((d) => setReady(d.checkoutEnabled))
      .catch(() => setReady(false));
    idempotency.current = crypto.randomUUID();
    request<{ user: { email: string } | null }>("/api/auth/me")
      .then((d) => {
        if (d.user?.email) setEmail(d.user.email);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (
      !order ||
      order.paymentStatus === "paid" ||
      ["canceled", "cancelled"].includes(order.status)
    )
      return;
    const timer = setInterval(() => {
      request<Order | { order: Order }>(`/api/orders/${order.id}`)
        .then((d) => setOrder("order" in d ? d.order : d))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [order?.id, order?.paymentStatus, order?.status]);
  async function checkout(e: FormEvent) {
    e.preventDefault();
    if (!ready || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setFormError("");
    try {
      const confirmedCart = await awaitCartMutations();
      if (!confirmedCart.items.length) {
        await refresh();
        return;
      }
      if (confirmedCart.total !== cart.total) {
        throw Object.assign(new Error("TOTAL_CHANGED"), {
          code: "TOTAL_CHANGED",
        });
      }
      const created = await post<Order | { order: Order }>("/api/checkout", {
        email,
        phone,
        fulfillment: "pickup",
        expectedTotal: confirmedCart.total,
        idempotencyKey: idempotency.current,
        locale,
      });
      setOrder("order" in created ? created.order : created);
      cartChanged();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "TOTAL_CHANGED") {
        await refresh();
        setFormError(
          {
            ru: "Цена изменилась. Проверьте новую сумму и подтвердите заказ ещё раз.",
            kk: "Баға өзгерді. Жаңа соманы тексеріп, тапсырысты қайта растаңыз.",
            en: "The price changed. Review the new total and confirm your order again.",
          }[locale],
        );
      } else if (code === "OUT_OF_STOCK") {
        await refresh();
        setFormError(
          {
            ru: "Выбранный размер закончился. Измените корзину.",
            kk: "Таңдалған өлшем таусылды. Себетті өзгертіңіз.",
            en: "The selected size sold out. Update your bag.",
          }[locale],
        );
      } else setFormError(t.orderError);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function simulate() {
    if (!order?.simulationAllowed) return;
    setBusy(true);
    try {
      const updated = await post<Order | { order: Order }>(
        `/api/orders/${order.id}/simulate`,
        { status: "paid" },
      );
      setOrder("order" in updated ? updated.order : updated);
    } catch {
      setFormError(t.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ShopShell locale={locale} settings={settings} initialCart={initialCart}>
      <section className={s.innerPage}>
        {order ? (
          <div className={s.orderSuccess}>
            <div
              className={`${s.successMark} ${order.paymentStatus === "paid" ? s.successPaid : ""}`}
            >
              <Check size={42} weight="bold" />
            </div>
            <p className={s.eyebrow}>
              {t.orderNumber}{" "}
              {order.number || order.id.slice(0, 8).toUpperCase()}
            </p>
            <h1>
              {order.paymentStatus === "paid" ? t.paid : t.orderReceived}
              <span className={s.titleDot}>.</span>
            </h1>
            <p>{t.orderHint}</p>
            <div className={s.orderReceipt}>
              <div>
                <span>{t.status}</span>
                <strong aria-live="polite">{statusLabel(order, locale)}</strong>
              </div>
              <div>
                <span>{t.total}</span>
                <strong>{money(order.total, locale)}</strong>
              </div>
              <div>
                <span>{t.pickup}</span>
                <strong>{pickupAddress(settings, locale)}</strong>
              </div>
            </div>
            {(order.paymentUrl || order.invoiceUrl) &&
              order.paymentStatus !== "paid" && (
                <a
                  className={s.primaryButton}
                  href={order.paymentUrl || order.invoiceUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t.kaspi}
                  <ArrowRight size={22} />
                </a>
              )}
            {order.simulationAllowed && order.paymentStatus !== "paid" && (
              <button
                className={s.outlineButton}
                disabled={busy}
                onClick={simulate}
              >
                {busy ? t.loading : t.simulate}
              </button>
            )}
            {formError && <ErrorNotice text={formError} />}
            <Link prefetch={false} href={`/${locale}`} className={s.textButton}>
              {t.continueShopping}
              <ArrowRight size={20} />
            </Link>
          </div>
        ) : (
          <>
            <PageTitle title={t.checkoutTitle} locale={locale} />
            {loading ? (
              <div className={s.loading}>{t.loading}</div>
            ) : error ? (
              <ErrorNotice text={t.error} />
            ) : !cart.items.length ? (
              <Empty title={t.cartEmpty}>
                <Link
                  prefetch={false}
                  className={s.primaryButton}
                  href={`/${locale}`}
                >
                  {t.toCatalog}
                  <ArrowRight size={20} />
                </Link>
              </Empty>
            ) : (
              <form className={s.checkoutLayout} onSubmit={checkout}>
                <div className={s.checkoutFields}>
                  <section className={s.formSection}>
                    <h2>
                      <span>01</span>
                      {t.contacts}
                    </h2>
                    <label className={s.field}>
                      {t.email}
                      <input
                        aria-label={t.email}
                        required
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                      />
                      <small>{t.emailHint}</small>
                    </label>
                    <label className={s.field}>
                      {t.phone}
                      <input
                        aria-label={t.phone}
                        required
                        type="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+7 (___) ___ __ __"
                      />
                      <small>{t.phoneHint}</small>
                    </label>
                  </section>
                  <section className={s.formSection}>
                    <h2>
                      <span>02</span>
                      {t.pickup}
                    </h2>
                    <label
                      className={`${s.deliveryOption} ${s.selectedDelivery}`}
                    >
                      <input
                        type="radio"
                        name="fulfillment"
                        value="pickup"
                        defaultChecked
                      />
                      <div>
                        <strong>{t.pickup}</strong>
                        <span>{pickupAddress(settings, locale)}</span>
                        <p>{t.pickupHint}</p>
                        {typeof settings?.pickupHours === "string" && (
                          <small>{pickupHours(settings, locale)}</small>
                        )}
                      </div>
                      <MapPin size={24} weight="bold" />
                    </label>
                    <label
                      className={`${s.deliveryOption} ${s.disabledDelivery}`}
                    >
                      <input
                        type="radio"
                        disabled
                        name="fulfillment"
                        value="kazpost"
                      />
                      <strong>{t.delivery}</strong>
                      <span>{t.unavailable}</span>
                    </label>
                  </section>
                </div>
                <CartSummary cart={cart} locale={locale}>
                  <div className={s.checkoutPreview}>
                    {cart.items.map((item) => (
                      <div key={item.variantId}>
                        <span>
                          {item.product.names[locale]}{" "}
                          <small>
                            {item.size} × {item.quantity}
                          </small>
                        </span>
                        <strong>
                          {money(item.product.price * item.quantity, locale)}
                        </strong>
                      </div>
                    ))}
                  </div>
                  {formError && <ErrorNotice text={formError} />}
                  {ready === false && (
                    <p className={s.note} role="status">
                      {locale === "ru"
                        ? "Оплата пока недоступна"
                        : locale === "kk"
                          ? "Төлем әзірге қолжетімсіз"
                          : "Payments are not available yet"}
                    </p>
                  )}
                  <button
                    className={s.primaryButton}
                    disabled={busy || !ready}
                    type="submit"
                  >
                    {busy ? t.loading : t.placeOrder}
                    <ArrowRight size={21} weight="bold" />
                  </button>
                  <p className={s.summaryNote}>{t.paymentHint}</p>
                </CartSummary>
              </form>
            )}
          </>
        )}
      </section>
    </ShopShell>
  );
}

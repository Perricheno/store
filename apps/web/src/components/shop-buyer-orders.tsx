"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "../lib/i18n";
import { money } from "../lib/i18n";
import { findOwnOrder, orderFingerprint, parseReadMarkers } from "../lib/buyer-device";
import type { Order } from "./shop-types";
import { buyerCopy } from "./buyer-copy";
import { statusLabel } from "./shop-client";
import s from "./shop-buyer.module.css";

export function BuyerOrders({ userId, orders, locale, refresh, busy }: {
  userId: string; orders: Order[]; locale: Locale; refresh: () => Promise<void>; busy: boolean;
}) {
  const copy = buyerCopy[locale];
  const [markers, setMarkers] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false), [storageError, setStorageError] = useState(false);
  const [query, setQuery] = useState(""), [checked, setChecked] = useState<string | null>(null), [notice, setNotice] = useState("");
  const key = `urbanmag:order-read:v1:${userId}`;
  useEffect(() => {
    function sync() {
      try { setMarkers(parseReadMarkers(localStorage.getItem(key))); }
      catch { setStorageError(true); }
      setReady(true);
    }
    sync(); window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key]);
  function markRead(items: Order[]) {
    const next = Object.fromEntries(orders.slice(0, 200).filter((order) => markers[order.id]).map((order) => [order.id, markers[order.id]]));
    for (const order of items.slice(0, 200)) next[order.id] = orderFingerprint(order);
    setMarkers(next);
    try { localStorage.setItem(key, JSON.stringify(next)); setStorageError(false); }
    catch { setStorageError(true); }
  }
  function check(event: FormEvent) { event.preventDefault(); setChecked(findOwnOrder(orders, query)?.id || ""); }
  const found = orders.find((order) => order.id === checked);
  const notifications = orders.slice(0, 200);
  const unread = notifications.filter((order) => markers[order.id] !== orderFingerprint(order));
  return <>
    <section className={s.section} id="purchases">
      <div className={s.sectionHead}><h2>{copy.purchases} <small>{orders.length}</small></h2>
        <button type="button" disabled={busy} onClick={async () => { setNotice(""); try { await refresh(); setNotice(copy.refreshed); } catch { /* Account renders the translated error. */ } }}>{copy.refresh}</button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {!orders.length && <p>{copy.noNotifications}</p>}
      {orders.map((order) => <OrderDetails key={order.id} order={order} locale={locale} />)}
    </section>
    <section className={s.section} id="notifications">
      <div className={s.sectionHead}><h2>{copy.notifications} <small>{ready ? unread.length : ""}</small></h2>
        <button type="button" disabled={!ready || !unread.length} onClick={() => markRead(notifications)}>{copy.markAll}</button>
      </div><p>{copy.notificationsHint}</p>
      {storageError && <p role="status">{copy.storageError}</p>}
      {!orders.length && <p>{copy.noNotifications}</p>}
      <ul className={s.notificationList}>{notifications.map((order) => {
        const read = markers[order.id] === orderFingerprint(order);
        return <li key={order.id} className={s.notification} data-read={read}>
          <strong>{`#${order.number || order.id.slice(0, 8).toUpperCase()} · ${statusLabel(order, locale)}`}</strong>
          {read ? <small>{copy.read}</small> : <button type="button" disabled={!ready} onClick={() => markRead([order])}>{copy.markRead}</button>}
        </li>;
      })}</ul>
    </section>
    <section className={s.section} id="check-order"><h2>{copy.checkOrder}</h2><p>{copy.checkHint}</p>
      <form onSubmit={check} className={s.lookup}><label>{copy.orderCode}<input required maxLength={128} autoComplete="off" value={query} onChange={(event) => { setQuery(event.target.value); setChecked(null); }} /></label>
        <button type="submit">{copy.checkOrder}</button></form>
      {checked === "" && <p role="status">{copy.notFound}</p>}
      {found && <OrderDetails order={found} locale={locale} open />}
    </section>
  </>;
}
function OrderDetails({ order, locale, open }: { order: Order; locale: Locale; open?: boolean }) {
  const copy = buyerCopy[locale];
  return <details className={s.orderDetails} open={open}>
    <summary>#{order.number || order.id.slice(0, 8).toUpperCase()} · {money(order.total, locale)} · <span>{statusLabel(order, locale)}</span></summary>
    <div className={s.orderMeta}>{order.createdAt && <time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleDateString(locale === "kk" ? "kk-KZ" : locale === "en" ? "en-GB" : "ru-RU")}</time>}</div>
    <p className={s.orderId}>{copy.orderCode}: {order.id}</p>
    {!!order.lines?.length && <><h3>{copy.items}</h3><ul>{order.lines.map((line, index) => <li key={`${line.variantId}:${index}`}>
      {line.names?.[locale] || line.name} · {line.size}{line.color ? ` / ${line.color}` : ""} · {line.quantity} × {money(line.price, locale)}
    </li>)}</ul></>}
  </details>;
}

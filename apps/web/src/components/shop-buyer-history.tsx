"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Product } from "@urbanmag/core";
import { HISTORY_KEY, emptyHistory, parseHistory, rankSuggestions, recordView, type ViewHistory } from "../lib/buyer-device";
import { money, type Locale } from "../lib/i18n";
import { request } from "./shop-client";
import { buyerCopy } from "./buyer-copy";
import { ProductMedia } from "./shop-media";
import s from "./shop-buyer.module.css";

const eventName = "urbanmag:history";
let memoryHistory: ViewHistory | undefined;
let memoryOnly = false;
function readHistory() {
  if (memoryOnly) return memoryHistory || emptyHistory();
  try {
    const value = parseHistory(localStorage.getItem(HISTORY_KEY));
    memoryHistory = value;
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(value)); } catch { memoryOnly = true; }
    return value;
  }
  catch { memoryOnly = true; return memoryHistory || emptyHistory(); }
}
function saveHistory(value: ViewHistory): boolean {
  memoryHistory = value;
  let saved = true;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(value)); } catch { saved = false; memoryOnly = true; }
  window.dispatchEvent(new Event(eventName));
  return saved;
}
export function recordDeviceView(product: Pick<Product, "slug" | "category">) {
  saveHistory(recordView(readHistory(), product));
}
export function BuyerHistory({ locale, controls = true }: { locale: Locale; controls?: boolean }) {
  const copy = buyerCopy[locale];
  const [history, setHistory] = useState<ViewHistory>(emptyHistory);
  const [ready, setReady] = useState(false), [storageError, setStorageError] = useState(false);
  const [viewed, setViewed] = useState<Product[]>([]), [suggestions, setSuggestions] = useState<Product[]>([]);
  const [error, setError] = useState(false), [retry, setRetry] = useState(0);
  const sync = useCallback(() => { setHistory(readHistory()); setStorageError(memoryOnly); setReady(true); }, []);
  useEffect(() => {
    sync();
    window.addEventListener(eventName, sync);
    window.addEventListener("storage", sync);
    const favoritesChanged = () => setRetry((value) => value + 1);
    window.addEventListener("urbanmag:favorites", favoritesChanged);
    return () => { window.removeEventListener(eventName, sync); window.removeEventListener("storage", sync); window.removeEventListener("urbanmag:favorites", favoritesChanged); };
  }, [sync]);
  const entriesKey = history.entries.map((entry) => `${entry.slug}:${entry.viewedAt}`).join("|");
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setError(false);
    const entries = history.entries;
    const query = new URLSearchParams();
    for (const entry of entries) query.append("slug", entry.slug);
    async function load() {
      try {
        const [recent, saved] = await Promise.all([
          entries.length ? request<{ products: Product[] }>(`/api/buyer-products?${query}`, { signal: controller.signal }) : Promise.resolve({ products: [] }),
          request<{ products: Product[] }>("/api/favorites", { signal: controller.signal }),
        ]);
        if (controller.signal.aborted) return;
        setViewed(recent.products);
        const categories = [...new Set([...entries.map((entry) => entry.category), ...saved.products.map((product) => product.category)])].slice(0, 3);
        const catalog = await Promise.all(categories.map((category) => request<{ products: Product[] }>(
          `/api/products?${new URLSearchParams({ category, pageSize: "24", available: "true" })}`, { signal: controller.signal },
        )));
        if (!controller.signal.aborted) setSuggestions(rankSuggestions(catalog.flatMap((page) => page.products), entries, saved.products));
      } catch { if (!controller.signal.aborted) { setError(true); setViewed([]); setSuggestions([]); } }
    }
    void load();
    return () => controller.abort();
  }, [entriesKey, ready, retry]);
  function update(value: ViewHistory) { setViewed([]); setSuggestions([]); setStorageError(!saveHistory(value)); setHistory(value); }
  return (
    <div className={s.historyArea}>
      <section className={s.section} aria-labelledby="recent-heading">
        <div className={s.sectionHead}><h2 id="recent-heading">{copy.viewed}</h2>
          {!controls && <Link href={`/${locale}/account#history`} prefetch={false}>{copy.profile}</Link>}
        </div>
        <p>{copy.historyHint}</p>
        {controls && <div className={s.controls}>
          <label><input type="checkbox" checked={history.enabled} disabled={!ready} onChange={(event) => update({ enabled: event.target.checked, entries: [] })} />{copy.saveHistory}</label>
          <button type="button" disabled={!ready || !history.entries.length} onClick={() => update({ ...history, entries: [] })}>{copy.clearHistory}</button>
        </div>}
        {storageError && <p role="status">{copy.storageError}</p>}
        {error && <button type="button" onClick={() => setRetry((value) => value + 1)}>{locale === "ru" ? "Повторить загрузку" : locale === "kk" ? "Қайта жүктеу" : "Retry loading"}</button>}
        {ready && !history.entries.length && <p>{history.enabled ? copy.noHistory : copy.historyDisabled}</p>}
        <ProductShelf products={viewed} locale={locale} />
      </section>
      {!!suggestions.length && <section className={s.section} aria-labelledby="suggestions-heading">
        <h2 id="suggestions-heading">{copy.suggestions}</h2><p>{copy.suggestionsHint}</p>
        <ProductShelf products={suggestions} locale={locale} />
      </section>}
    </div>
  );
}
function ProductShelf({ products, locale }: { products: Product[]; locale: Locale }) {
  return <div className={s.shelf}>{products.map((product) => <Link prefetch={false} href={`/${locale}/p/${product.slug}`} key={product.id} className={s.shelfCard}>
    <div className={s.shelfImage}><ProductMedia product={product} locale={locale} /></div>
    <strong>{product.names[locale] || product.names.ru}</strong><span>{money(product.price, locale)}</span>
  </Link>)}</div>;
}

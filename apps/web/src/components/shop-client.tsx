"use client";

import { useEffect, useSyncExternalStore } from "react";
import { dictionary, type Locale } from "../lib/i18n";
import { buyerOrderStatus } from "../lib/buyer-status";
import { ensureVisitor } from "../lib/visitor-client";
import { type Cart, type ShopSettings, type Order } from "./shop-types";

import type { Product } from "@urbanmag/core";
import { createCartStore, emptyCart } from "../lib/cart-store";
export { emptyCart } from "../lib/cart-store";

export async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  if (/^\/api\/(cart|favorites|checkout|orders)(?:[/?]|$)/.test(url))
    await ensureVisitor();
  const res = await fetch(url, {
    credentials: "same-origin",
    ...options,
    signal: options?.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(10000)])
      : AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await res.json();
  if (!res.ok)
    throw Object.assign(new Error(data.error || "Request failed"), {
      code: data.code,
    });
  return data;
}

export function post<T>(url: string, data: unknown, method = "POST") {
  return request<T>(url, {
    method,
    body: JSON.stringify(data),
    keepalive: true,
  });
}

export function localized(value: unknown, locale: Locale): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object")
    return String(
      (value as Record<string, unknown>)[locale] ||
        (value as Record<string, unknown>).ru ||
        "",
    );
  return "";
}

export function pickupAddress(
  settings: ShopSettings | undefined,
  locale: Locale,
) {
  const t = dictionary(locale);
  const raw = localized(settings?.pickupAddress || settings?.address, locale);
  const address =
    raw === "Адрес самовывоза уточняется"
      ? {
          ru: "Адрес самовывоза уточняется",
          kk: "Алып кету мекенжайы нақтылануда",
          en: "Pickup address to be confirmed",
        }[locale]
      : raw;
  const rawCity = settings?.pickupCity;
  const city =
    rawCity && /Жезказган|Жезқазған|Zhezkazgan/i.test(rawCity)
      ? t.address
      : rawCity || t.address;
  return address
    ? address.toLowerCase().includes(city.toLowerCase())
      ? address
      : `${city}, ${address}`
    : city;
}

export function pickupHours(
  settings: ShopSettings | undefined,
  locale: Locale,
) {
  const hours = settings?.pickupHours;
  return hours === "График уточняется"
    ? {
        ru: hours,
        kk: "Жұмыс уақыты нақтылануда",
        en: "Opening hours to be confirmed",
      }[locale]
    : hours;
}

const cartStore = createCartStore({
  read: () => request<Cart>("/api/cart", { cache: "no-store" }),
  mutate: ({ variantId, productId, selectVariantId, quantity, method }) =>
    post<Cart>("/api/cart", { variantId, productId, selectVariantId, quantity }, method),
});
let listening = false;
function listenForCartChanges() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("urbanmag:cart", () => {
    void cartStore.refresh().catch(() => {});
  });
}
export function useCart(initialCart?: Cart) {
  // Server snapshots retain the request's cart; browser state is shared across routes.
  const serverSnapshot = {
    cart: initialCart ?? emptyCart,
    loading: !initialCart,
    error: false,
    pending: false,
  };
  const state = useSyncExternalStore(
    cartStore.subscribe,
    cartStore.getSnapshot,
    () => serverSnapshot,
  );
  useEffect(() => {
    listenForCartChanges();
    cartStore.seed(initialCart);
    void cartStore.refresh().catch(() => {});
  }, []);
  return { ...state, refresh: cartStore.refresh };
}
export function optimisticAddToCart(
  product: Product,
  variant: Product["sizes"][number],
  quantity = 1,
) {
  listenForCartChanges();
  return cartStore.add(product, variant, quantity);
}
export function optimisticAddProductToCart(product: Product, quantity = 1) {
  listenForCartChanges();
  return cartStore.addProduct(product, quantity);
}
export const optimisticCartQuantity = cartStore.setQuantity;
export const optimisticCartSize = cartStore.selectSize;
export const awaitCartMutations = () => cartStore.settled();
export function cartChanged() {
  listenForCartChanges();
  window.dispatchEvent(new Event("urbanmag:cart"));
}

export function statusLabel(order: Order, locale: Locale) {
  return buyerOrderStatus(order, locale);
}

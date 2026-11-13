"use client";

import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { type Locale } from "../lib/i18n";
import type { Product } from "@urbanmag/core";
import { categoryName } from "../lib/categories";
import s from "./shop.module.css";
import { categoryMasks } from "../lib/category-masks";

// One observer serves every fallback icon; no animation work for hidden cards.
export let gleamObserver: IntersectionObserver | undefined;

export const observedGleams = new Set<HTMLDivElement>();

export function observeGleam(element: HTMLDivElement) {
  if (typeof IntersectionObserver === "undefined") {
    element.dataset.gleamVisible = "true";
    return () => {};
  }
  gleamObserver ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const target = entry.target as HTMLDivElement;
      if (observedGleams.has(target))
        target.dataset.gleamVisible = String(entry.isIntersecting);
    }
  });
  observedGleams.add(element);
  gleamObserver.observe(element);
  return () => {
    gleamObserver?.unobserve(element);
    observedGleams.delete(element);
    if (observedGleams.size === 0) {
      gleamObserver?.disconnect();
      gleamObserver = undefined;
    }
  };
}

/** A static alpha mask clips a compositor transform, avoiding animated SVG paints. */
export const ClothingArt = memo(function ClothingArt({
  product,
  className,
  locale = "ru",
  hidden = false,
}: {
  product: Product;
  className?: string;
  locale?: Locale;
  hidden?: boolean;
}) {
  const icon = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hidden && icon.current) return observeGleam(icon.current);
    if (icon.current) icon.current.dataset.gleamVisible = "false";
  }, [hidden]);
  const mask = categoryMasks[product.category] ?? categoryMasks["t-shirts"];
  return (
    <div
      ref={icon}
      className={className}
      data-gleam-visible="false"
      data-photo-loaded={hidden}
      role="img"
      aria-hidden={hidden || undefined}
      aria-label={
        categoryName(locale, product.category) || product.names[locale]
      }
      style={{ "--category-mask": `url("${mask}")` } as CSSProperties}
    >
      <span className={s.categoryMask} aria-hidden="true">
        <span className={s.gleam} />
      </span>
    </div>
  );
});

export function ProductMedia({
  product,
  large = false,
  locale = "ru",
  imageIndex = 0,
}: {
  product: Product;
  large?: boolean;
  locale?: Locale;
  imageIndex?: number;
}) {
  const source = product.media?.[imageIndex];
  const [state, setState] = useState<"loading" | "loaded" | "error">(
    source ? "loading" : "error",
  );
  useEffect(() => setState(source ? "loading" : "error"), [product.id, source]);
  return (
    <div className={`${s.productMedia} ${large ? s.largeMedia : ""}`}>
      <ClothingArt
        product={product}
        locale={locale}
        className={s.garment}
        hidden={state === "loaded"}
      />
      {source && state !== "error" && (
        <img
          src={source}
          loading={large ? "eager" : "lazy"}
          decoding="async"
          alt={product.names[locale] || product.names.ru}
          className={`${s.realImage} ${state === "loaded" ? s.imageLoaded : ""}`}
          onLoad={() => setState("loaded")}
          onError={() => setState("error")}
        />
      )}
    </div>
  );
}

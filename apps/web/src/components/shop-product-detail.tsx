"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Heart,
  MapPin,
  Plus,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react";
import { dictionary, money } from "../lib/i18n";
import type { Product } from "@urbanmag/core";
import s from "./shop.module.css";
import { type Common } from "./shop-types";
import { catalogCopy } from "./shop-copy";
import {
  request,
  post,
  optimisticAddToCart,
  pickupAddress,
} from "./shop-client";
import { ShopShell } from "./shop-shell";
import { ProductMedia } from "./shop-media";
import { ErrorNotice } from "./shop-ui";
import {
  ProductPromotion,
  ProductSpecifications,
} from "./shop-product-features";

export function ProductDetail({
  locale,
  product,
  settings,
  initialCart,
}: Common & { product: Product }) {
  const t = dictionary(locale),
    copy = catalogCopy[locale];
  const [imageIndex, setImageIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [variant, setVariant] = useState(""),
    [busy, setBusy] = useState(false),
    [added, setAdded] = useState(false),
    [error, setError] = useState(""),
    [favorite, setFavorite] = useState(false),
    [favoriteReady, setFavoriteReady] = useState(false),
    [favoritePending, setFavoritePending] = useState(false);
  const favoriteLock = useRef(false);
  const addLock = useRef(false);
  const sizeGroup = useRef<HTMLDivElement>(null);
  const inStock = product.sizes.some((v) => v.available > 0);
  const name = product.names[locale] || product.names.ru;
  useEffect(() => setReady(true), []);
  useEffect(() => {
    setImageIndex(0);
    setVariant("");
    setAdded(false);
    setError("");
  }, [product.id]);
  useEffect(() => {
    setFavoriteReady(false);
    request<Product[] | { products: Product[] }>("/api/favorites")
      .then((data) => {
        setFavorite(
          (Array.isArray(data) ? data : data.products).some(
            (p) => p.id === product.id,
          ),
        );
        setFavoriteReady(true);
      })
      .catch(() => setError(t.error))
      .finally(() => setFavoriteReady(true));
  }, [product.id, t.error]);
  async function add() {
    if (addLock.current) return;
    const selected = product.sizes.find(
      (item) => item.id === variant && item.available > 0,
    );
    if (!selected) {
      setError(t.selectSize);
      sizeGroup.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      sizeGroup.current?.querySelector("button")?.focus();
      return;
    }
    addLock.current = true;
    setBusy(true);
    setAdded(true);
    setError("");
    try {
      await optimisticAddToCart(product, selected);
    } catch {
      setAdded(false);
      setError(t.cartError);
    } finally {
      addLock.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (!favoriteReady || favoriteLock.current) return;
    favoriteLock.current = true;
    setFavoritePending(true);
    try {
      const data = await post<{ productIds: string[] }>("/api/favorites", {
        productId: product.id,
      });
      setFavorite(data.productIds.includes(product.id));
    } catch {
      setError(t.error);
    } finally {
      favoriteLock.current = false;
      setFavoritePending(false);
    }
  }
  return (
    <ShopShell locale={locale} settings={settings} initialCart={initialCart}>
      <div className={s.detailBreadcrumb}>
        <Link prefetch={false} href={`/${locale}`}>
          <ArrowLeft size={18} weight="bold" />
          {t.catalog}
        </Link>
        <span>
          {product.isDemo && product.brand.toUpperCase() === "DEMO"
            ? name
            : `${product.brand} / ${name}`}
        </span>
      </div>
      <article className={s.productDetail}>
        <div className={s.detailGallery}>
          <div className={s.detailVisual}>
            <ProductMedia
              key={`${product.id}:${imageIndex}`}
              product={product}
              large
              locale={locale}
              imageIndex={imageIndex}
            />
            <span className={s.visualIndex}>
              URBANMAG / {product.category.toUpperCase()}
            </span>
            {product.media.length > 1 && (
              <div className={s.galleryArrows}>
                <button
                  className={s.iconButton}
                  disabled={!ready}
                  onClick={() =>
                    setImageIndex(
                      (index) =>
                        (index - 1 + product.media.length) %
                        product.media.length,
                    )
                  }
                  aria-label={copy.previousPhoto}
                >
                  <CaretLeft size={21} weight="bold" />
                </button>
                <button
                  className={s.iconButton}
                  disabled={!ready}
                  onClick={() =>
                    setImageIndex((index) => (index + 1) % product.media.length)
                  }
                  aria-label={copy.nextPhoto}
                >
                  <CaretRight size={21} weight="bold" />
                </button>
              </div>
            )}
          </div>
          {product.media.length > 1 && (
            <div className={s.galleryThumbs} role="group" aria-label={name}>
              {product.media.map((source, index) => (
                <button
                  key={`${source}:${index}`}
                  className={imageIndex === index ? s.activeThumbnail : ""}
                  disabled={!ready}
                  onClick={() => setImageIndex(index)}
                  aria-label={copy.photo(index + 1)}
                  aria-pressed={imageIndex === index}
                >
                  <img
                    src={source}
                    alt=""
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.visibility = "hidden";
                    }}
                  />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={s.detailInfo}>
          <div className={s.detailBrand}>
            {!(product.isDemo && product.brand.toUpperCase() === "DEMO") &&
              product.brand}
            <button
              className={`${s.iconButton} ${favorite ? s.isFavorite : ""}`}
              aria-label={favorite ? t.removeFavorite : t.addFavorite}
              aria-pressed={favorite}
              disabled={!favoriteReady || favoritePending}
              onClick={save}
            >
              <Heart size={24} weight={favorite ? "fill" : "bold"} />
            </button>
          </div>
          <ProductPromotion product={product} locale={locale} />
          <h1>{name}</h1>
          <p className={s.detailPrice}>
            {money(product.price, locale)}
            {product.oldPrice && product.oldPrice > product.price && (
              <del>{money(product.oldPrice, locale)}</del>
            )}
          </p>
          <div className={s.sizeSection} ref={sizeGroup}>
            <div className={s.labelRow}>
              <h2>{t.size}</h2>
              <span>{t.availableSizes}</span>
            </div>
            <div className={s.sizeRow}>
              {product.sizes.map((v) => (
                <button
                  key={v.id}
                  className={`${s.sizeButton} ${variant === v.id ? s.selectedSize : ""}`}
                  disabled={!ready || busy || !v.available}
                  aria-pressed={variant === v.id}
                  onClick={() => {
                    setVariant(v.id);
                    setError("");
                    setAdded(false);
                  }}
                >
                  {v.size}
                  {product.sizes.some(
                    (p) => p.size === v.size && p.color !== v.color,
                  ) && <small>{v.color}</small>}
                </button>
              ))}
            </div>
            <p className={s.sizeHelp}>{t.sizeGuide}</p>
          </div>
          {error && <ErrorNotice text={error} />}
          <div className={s.detailActions}>
            <button
              className={s.primaryButton}
              onClick={add}
              disabled={!ready || busy || !inStock}
            >
              {!inStock ? t.soldOut : added ? t.addedCart : t.addCart}
              {added ? (
                <Check size={22} weight="bold" />
              ) : (
                <Plus size={22} weight="bold" />
              )}
            </button>
            {added && (
              <Link
                prefetch={false}
                className={s.textButton}
                href={`/${locale}/cart`}
              >
                {t.goCart}
                <ArrowRight size={18} />
              </Link>
            )}
            {product.kaspiUrl && (
              <>
                <a
                  href={product.kaspiUrl}
                  className={s.kaspiButton}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {t.kaspi}
                  <ArrowRight size={22} weight="bold" />
                </a>
                <p className={s.sizeHelp}>{t.kaspiHint}</p>
              </>
            )}
          </div>
          {(product.description[locale]?.trim() ||
            product.description.ru?.trim()) && (
            <div className={s.description}>
              <h2>{t.description}</h2>
              <p>
                {product.description[locale]?.trim() ||
                  product.description.ru?.trim()}
              </p>
            </div>
          )}
          <ProductSpecifications product={product} locale={locale} />
          <div className={s.pickupLine}>
            <MapPin size={20} weight="bold" />
            <div>
              <strong>{t.pickup}</strong>
              <p>{pickupAddress(settings, locale)}</p>
            </div>
          </div>
        </div>
      </article>
      <div className={s.mobileCta}>
        <span>{money(product.price, locale)}</span>
        <button
          className={s.primaryButton}
          onClick={add}
          disabled={!ready || busy || !inStock}
        >
          {!inStock ? t.soldOut : added ? t.addedCart : t.addCart}
          {added ? <Check size={20} weight="bold" /> : <Plus size={20} />}
        </button>
      </div>
    </ShopShell>
  );
}

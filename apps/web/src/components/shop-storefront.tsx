"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Heart,
  MagnifyingGlass,
  Plus,
} from "@phosphor-icons/react";
import { dictionary, money, type Locale } from "../lib/i18n";
import type { Product } from "@urbanmag/core";
import {
  CATALOG_PAGE_SIZE,
  categoryName,
  catalogQuery,
  type CatalogFilterState,
} from "../lib/categories";
import s from "./shop.module.css";
import {
  type Common,
  type CatalogPagination,
  type CatalogPage,
} from "./shop-types";
import { localized, request, post } from "./shop-client";
import { ProductMedia } from "./shop-media";
import { BuyerHistory } from "./shop-buyer-history";
import { catalogCopy } from "./shop-copy";
import {
  ProductPromotion,
  ProductQuickAdd,
  ProductQuickAddProvider,
} from "./shop-product-features";
import { ErrorNotice, Empty } from "./shop-ui";
import { ShopFilters } from "./shop-filters";
import { catalogFiltersFromLocation, catalogLocation } from "../lib/catalog-filter-controls";

export function StorePromotions({ locale, settings }: Common) {
  const t = dictionary(locale);
  const banner = settings?.banner;
  const title = localized(banner?.title, locale).trim();
  if (!banner?.enabled || !(title || banner.imageUrl)) return null;
  const href = banner.href;
  const safeHref =
    href && /^\/(?!\/)/.test(href) && !/[\\\u0000-\u001f]/.test(href)
      ? href
      : undefined;
  const content = (
    <>
      {banner.imageUrl && (
        <img
          src={banner.imageUrl}
          alt={title ? "" : t.promoBanner}
          loading="lazy"
          decoding="async"
        />
      )}
      {title && <span>{title}</span>}
      {safeHref && <ArrowRight size={22} weight="bold" aria-hidden="true" />}
    </>
  );
  return (
    <aside className={s.promotions} aria-label={t.storeAnnouncements}>
      {safeHref ? (
        <a className={s.promoBanner} href={safeHref}>
          {content}
        </a>
      ) : (
        <div className={s.promoBanner}>{content}</div>
      )}
    </aside>
  );
}

const ProductCard = memo(function ProductCard({
  product,
  locale,
  favorite,
  onFavorite,
  favoritePending,
}: {
  product: Product;
  locale: Locale;
  favorite: boolean;
  favoritePending: boolean;
  onFavorite: (p: Product) => void;
}) {
  const t = dictionary(locale);
  const stock = product.sizes.some((v) => v.available > 0);
  return (
    <article className={s.productCard}>
      <div className={s.cardImage}>
        <Link
          prefetch={false}
          href={`/${locale}/p/${product.slug}`}
          tabIndex={-1}
          aria-hidden="true"
        >
          <ProductMedia product={product} locale={locale} />
        </Link>
        <ProductPromotion product={product} locale={locale} overlay />
        <ProductQuickAdd product={product} locale={locale} />
        <button
          type="button"
          className={`${s.favorite} ${favorite ? s.isFavorite : ""}`}
          aria-label={favorite ? t.removeFavorite : t.addFavorite}
          aria-pressed={favorite}
          disabled={favoritePending}
          onClick={() => onFavorite(product)}
        >
          <Heart size={22} weight={favorite ? "fill" : "bold"} />
        </button>
        {!stock && !product.isDemo && (
          <span className={s.demoTag}>{t.soldOut}</span>
        )}
      </div>
      <div className={s.productMeta}>
        <div>
          {!(product.isDemo && product.brand.toUpperCase() === "DEMO") && (
            <p className={s.brand}>{product.brand}</p>
          )}
          <Link
            prefetch={false}
            href={`/${locale}/p/${product.slug}`}
            className={s.productName}
          >
            {product.names[locale] || product.names.ru}
          </Link>
        </div>
        <p className={s.productPrice}>
          {money(product.price, locale)}
          {product.oldPrice && product.oldPrice > product.price && (
            <del>{money(product.oldPrice, locale)}</del>
          )}
        </p>
      </div>
      <span className={s.cardSizes}>
        {product.sizes
          .filter((v) => v.available > 0)
          .map((v) => v.size)
          .filter((v, i, a) => a.indexOf(v) === i)
          .join(" / ") || "—"}
      </span>
    </article>
  );
});

export function Storefront({
  locale,
  products: initialProducts,
  settings,
  favoritesOnly = false,
  initialCategory = "all",
  initialPagination,
  initialFilters,
}: Common & {
  products: Product[];
  favoritesOnly?: boolean;
  initialCategory?: string;
  initialPagination?: CatalogPagination;
  initialFilters?: CatalogFilterState;
}) {
  const t = dictionary(locale),
    copy = catalogCopy[locale];
  const [products, setProducts] = useState(() =>
    initialProducts.slice(0, CATALOG_PAGE_SIZE),
  );
  const [pagination, setPagination] = useState<CatalogPagination>(
    () =>
      initialPagination || {
        total: initialProducts.length,
        page: 1,
        pageSize: CATALOG_PAGE_SIZE,
        hasMore: initialProducts.length > CATALOG_PAGE_SIZE,
      },
  );
  const [filters, setFilters] = useState<CatalogFilterState>(
    () =>
      initialFilters || {
        category: initialCategory,
        gender: "",
        q: "",
        sort: "newest",
        size: "",
        minPrice: "",
        maxPrice: "",
        available: false,
      },
  );
  const { gender, category } = filters;
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]),
    [favorites, setFavorites] = useState<Product[]>([]),
    [loading, setLoading] = useState(favoritesOnly),
    [favoriteReady, setFavoriteReady] = useState(false),
    [favoritePending, setFavoritePending] = useState(false),
    [error, setError] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false),
    [moreError, setMoreError] = useState(false),
    [retry, setRetry] = useState(0);
  const favoriteLock = useRef(false);
  const historyAction = useRef<"search" | "filter">("filter");
  const generation = useRef(0),
    moreController = useRef<AbortController | null>(null),
    loaded = useRef(false),
    clientFiltersChanged = useRef(false),
    serverSnapshot = useRef({
      initialProducts,
      initialFilters,
      initialPagination,
    });
  const query = catalogQuery(filters).toString();
  const serverQuery = initialFilters
    ? catalogQuery(initialFilters).toString()
    : null;
  useEffect(() => {
    const previous = serverSnapshot.current;
    if (
      previous.initialProducts === initialProducts &&
      previous.initialFilters === initialFilters &&
      previous.initialPagination === initialPagination
    )
      return;
    serverSnapshot.current = {
      initialProducts,
      initialFilters,
      initialPagination,
    };
    clientFiltersChanged.current = false;
    setRetry(0);
    if (initialFilters) setFilters(initialFilters);
    setProducts(initialProducts.slice(0, CATALOG_PAGE_SIZE));
    setPagination(
      initialPagination || {
        total: initialProducts.length,
        page: 1,
        pageSize: CATALOG_PAGE_SIZE,
        hasMore: initialProducts.length > CATALOG_PAGE_SIZE,
      },
    );
  }, [initialFilters, initialProducts, initialPagination]);
  function changeFilters(next: CatalogFilterState, search = false) {
    const target = catalogLocation(locale, next, initialCategory);
    if (window.location.pathname + window.location.search !== target) {
      if (search && historyAction.current === "search")
        window.history.replaceState(null, "", target);
      else window.history.pushState(null, "", target);
    }
    historyAction.current = search ? "search" : "filter";
    setFilters(next);
  }
  useEffect(() => {
    if (favoritesOnly) return;
    function restoreFilters() {
      historyAction.current = "filter";
      setFilters(catalogFiltersFromLocation(window.location.pathname, window.location.search));
    }
    window.addEventListener("popstate", restoreFilters);
    return () => window.removeEventListener("popstate", restoreFilters);
  }, [favoritesOnly]);
  useEffect(() => {
    request<Product[] | { products: Product[] }>("/api/favorites")
      .then((data) => {
        const list = Array.isArray(data) ? data : data.products || [];
        setFavorites(list);
        setFavoriteIds(list.map((p) => p.id));
        setFavoriteReady(true);
      })
      .catch(() => {
        if (favoritesOnly) setError(true);
      })
      .finally(() => {
        setFavoriteReady(true);
        if (favoritesOnly) setLoading(false);
      });
  }, [favoritesOnly]);
  useEffect(() => {
    if (favoritesOnly) return;
    const currentGeneration = ++generation.current;
    moreController.current?.abort();
    setMoreLoading(false);
    setMoreError(false);
    loaded.current = true;
    const params = new URLSearchParams(query);
    if (
      !clientFiltersChanged.current &&
      initialPagination &&
      query === serverQuery &&
      retry === 0
    ) {
      setLoading(false);
      return () => moreController.current?.abort();
    }
    clientFiltersChanged.current = true;
    setLoading(true);
    params.set("page", "1");
    params.set("pageSize", String(CATALOG_PAGE_SIZE));
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      request<CatalogPage>(`/api/products?${params}`, {
        signal: controller.signal,
      })
        .then((data) => {
          if (currentGeneration !== generation.current) return;
          setProducts(data.products);
          setPagination({
            total: data.total,
            page: data.page,
            pageSize: data.pageSize,
            hasMore: data.hasMore,
          });
          setError(false);
        })
        .catch((reason) => {
          if (
            reason.name !== "AbortError" &&
            currentGeneration === generation.current
          )
            setError(true);
        })
        .finally(() => {
          if (
            !controller.signal.aborted &&
            currentGeneration === generation.current
          )
            setLoading(false);
        });
    }, historyAction.current === "search" ? 200 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
      moreController.current?.abort();
    };
  }, [
    query,
    serverQuery,
    initialPagination,
    category,
    initialCategory,
    locale,
    favoritesOnly,
    retry,
  ]);
  async function loadMore() {
    if (!loaded.current || loading || moreLoading || !pagination.hasMore)
      return;
    const currentGeneration = generation.current,
      controller = new AbortController();
    moreController.current = controller;
    const params = new URLSearchParams(query);
    params.set("page", String(pagination.page + 1));
    params.set("pageSize", String(CATALOG_PAGE_SIZE));
    setMoreLoading(true);
    setMoreError(false);
    try {
      const data = await request<CatalogPage>(`/api/products?${params}`, {
        signal: controller.signal,
      });
      if (controller.signal.aborted || currentGeneration !== generation.current)
        return;
      setProducts((previous) => {
        const ids = new Set(previous.map((p) => p.id));
        const added = data.products.filter((product) => {
          if (ids.has(product.id)) return false;
          ids.add(product.id);
          return true;
        });
        return [...previous, ...added];
      });
      setPagination({
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        hasMore: data.hasMore,
      });
    } catch (reason) {
      if (
        !controller.signal.aborted &&
        currentGeneration === generation.current
      )
        setMoreError(true);
    } finally {
      if (
        !controller.signal.aborted &&
        currentGeneration === generation.current
      )
        setMoreLoading(false);
    }
  }
  const toggleFavorite = useCallback(
    async (p: Product) => {
      if (!favoriteReady || favoriteLock.current) return;
      favoriteLock.current = true;
      setFavoritePending(true);
      try {
        const data = await post<{ products: Product[]; productIds: string[] }>(
          "/api/favorites",
          { productId: p.id },
        );
        setFavoriteIds(data.productIds || data.products.map((p) => p.id));
        setFavorites(data.products);
        window.dispatchEvent(new Event("urbanmag:favorites"));
      } catch {
        setError(true);
      } finally {
        favoriteLock.current = false;
        setFavoritePending(false);
      }
    },
    [favoriteReady],
  );
  function reset() {
    changeFilters({
      category: "all", gender: "", q: "", sort: filters.sort,
      size: "", minPrice: "", maxPrice: "", available: false,
    });
  }
  const list = favoritesOnly ? favorites : products,
    total = favoritesOnly ? favorites.length : pagination.total;
  const heading = favoritesOnly
    ? t.favorites
    : categoryName(locale, category) ||
      (gender === "men" ? t.men : gender === "women" ? t.women : t.new);
  return (
    <>
      <ProductQuickAddProvider>
        {!favoritesOnly && (
          <StorePromotions locale={locale} settings={settings} />
        )}
        <section className={s.catalog}>
          <div className={s.catalogTop}>
            <div>
              <h1
                className={`${s.catalogTitle} ${heading.length > 7 ? s.longTitle : ""}`}
              >
                {heading}
                <span className={s.titleDot}>.</span>
              </h1>
            </div>
          </div>
          {!favoritesOnly && (
            <ShopFilters
              locale={locale}
              filters={filters}
              total={total}
              loading={loading}
              onChange={changeFilters}
            />
          )}
          {error && (
            <ErrorNotice
              text={t.error}
              action={() => setRetry((previous) => previous + 1)}
            />
          )}
          <div aria-busy={loading}>
            {list.length > 0 ? (
              <div className={s.productGrid} data-testid="catalog-grid">
                {list.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    locale={locale}
                    favorite={favoriteIds.includes(p.id)}
                    favoritePending={!favoriteReady || favoritePending}
                    onFavorite={toggleFavorite}
                  />
                ))}
              </div>
            ) : loading ? (
              <div className={s.loading}>{t.loading}</div>
            ) : (
              <Empty
                title={favoritesOnly ? t.favoritesEmpty : t.emptyCatalog}
                hint={favoritesOnly ? t.favoritesHint : t.emptyCatalogHint}
                icon={
                  favoritesOnly ? (
                    <Heart size={40} weight="bold" />
                  ) : (
                    <MagnifyingGlass size={40} weight="bold" />
                  )
                }
              >
                {favoritesOnly ? (
                  <Link
                    prefetch={false}
                    className={s.primaryButton}
                    href={`/${locale}`}
                  >
                    {t.toCatalog}
                    <ArrowRight size={20} />
                  </Link>
                ) : (
                  <button className={s.outlineButton} onClick={reset}>
                    {t.reset}
                  </button>
                )}
              </Empty>
            )}
          </div>
          {!favoritesOnly && list.length > 0 && (
            <div className={s.catalogPagination}>
              <p role="status">{copy.shown(list.length, total)}</p>
              {moreError && <ErrorNotice text={t.error} />}
              {pagination.hasMore && (
                <button
                  className={s.outlineButton}
                  onClick={loadMore}
                  disabled={loading || moreLoading}
                  aria-label={copy.loadMore}
                >
                  {moreLoading ? t.loading : copy.loadMore}
                  <Plus size={20} weight="bold" />
                </button>
              )}
            </div>
          )}
        </section>
        {!favoritesOnly && <BuyerHistory locale={locale} controls={false} />}
      </ProductQuickAddProvider>
    </>
  );
}

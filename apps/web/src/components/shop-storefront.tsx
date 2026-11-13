"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Heart,
  MagnifyingGlass,
  Plus,
  SlidersHorizontal,
  X,
  CoatHanger,
  SquaresFour,
} from "@phosphor-icons/react";
import { dictionary, money, type Locale } from "../lib/i18n";
import type { Product } from "@urbanmag/core";
import {
  CATEGORIES,
  CATALOG_PAGE_SIZE,
  categoryName,
  catalogQuery,
  type CatalogFilterState,
} from "../lib/categories";
import s from "./shop.module.css";
import { categoryIcons } from "../lib/category-icons";
import {
  type Common,
  type CatalogPagination,
  type CatalogPage,
} from "./shop-types";
import { localized, request, post } from "./shop-client";
import { ProductMedia } from "./shop-media";
import { catalogCopy } from "./shop-copy";
import { ShopShell } from "./shop-shell";
import {
  ProductPromotion,
  ProductQuickAdd,
  ProductQuickAddProvider,
} from "./shop-product-features";
import { ErrorNotice, Empty } from "./shop-ui";

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
  initialCart,
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
  const {
    gender,
    category,
    q,
    sort,
    size,
    minPrice: min,
    maxPrice: max,
    available,
  } = filters;
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
  const dialog = useRef<HTMLDialogElement>(null),
    generation = useRef(0),
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
  function setFilter<K extends keyof CatalogFilterState>(
    key: K,
    value: CatalogFilterState[K],
  ) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }
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
    const params = new URLSearchParams(query),
      urlParams = new URLSearchParams(query);
    if (category === initialCategory && initialCategory !== "all")
      urlParams.delete("category");
    const suffix = urlParams.toString() ? `?${urlParams}` : "";
    const target = `/${locale}${category === initialCategory && initialCategory !== "all" ? `/c/${initialCategory}` : ""}${suffix}`;
    if (window.location.pathname + window.location.search !== target)
      window.history.replaceState(null, "", target);
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
    }, 200);
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
    setFilters({
      category: "all",
      gender: "",
      q: "",
      sort: "newest",
      size: "",
      minPrice: "",
      maxPrice: "",
      available: false,
    });
  }
  const list = favoritesOnly ? favorites : products,
    total = favoritesOnly ? favorites.length : pagination.total;
  const activeCount = [size, min, max, available].filter(Boolean).length;
  const sizes = [
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "XXL",
    "36",
    "37",
    "38",
    "39",
    "40",
    "41",
    "42",
    "43",
    "44",
    "45",
    "46",
    "ONE SIZE",
  ];
  const heading = favoritesOnly
    ? t.favorites
    : categoryName(locale, category) ||
      (gender === "men" ? t.men : gender === "women" ? t.women : t.new);
  return (
    <ShopShell locale={locale} settings={settings} initialCart={initialCart}>
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
            <>
              <div className={s.genderTabs} role="group" aria-label={t.catalog}>
                {[
                  ["", t.new],
                  ["men", t.men],
                  ["women", t.women],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={gender === value ? s.activeTab : ""}
                    onClick={() => setFilter("gender", value)}
                  >
                    {label}
                    <ArrowRight size={18} />
                  </button>
                ))}
              </div>
              <div className={s.categoryRow}>
                <nav className={s.categoryScroll} aria-label={copy.categories}>
                  <button
                    className={category === "all" ? s.activeChip : ""}
                    onClick={() => setFilter("category", "all")}
                    aria-pressed={category === "all"}
                  >
                    <SquaresFour size={20} weight="bold" aria-hidden="true" />
                    {t.all}
                  </button>
                  {CATEGORIES.map((c) => {
                    const CategoryIcon = categoryIcons[c.id] || CoatHanger;
                    return (
                      <button
                        key={c.id}
                        className={category === c.id ? s.activeChip : ""}
                        onClick={() => setFilter("category", c.id)}
                        aria-pressed={category === c.id}
                      >
                        <CategoryIcon
                          size={20}
                          weight="bold"
                          aria-hidden="true"
                        />
                        {c.names[locale]}
                      </button>
                    );
                  })}
                </nav>
                <button
                  className={s.filterButton}
                  onClick={() => dialog.current?.showModal()}
                >
                  <SlidersHorizontal size={19} weight="bold" />
                  {t.filters}
                  {activeCount > 0 && <span>{activeCount}</span>}
                </button>
              </div>
              <div className={s.catalogUtilities}>
                <form
                  className={s.catalogSearch}
                  onSubmit={(e) => e.preventDefault()}
                >
                  <MagnifyingGlass size={19} weight="bold" />
                  <input
                    aria-label={t.search}
                    value={q}
                    onChange={(e) => setFilter("q", e.target.value)}
                    placeholder={t.searchPlaceholder}
                  />
                  {q && (
                    <button
                      type="button"
                      onClick={() => setFilter("q", "")}
                      aria-label={t.reset}
                    >
                      <X size={18} />
                    </button>
                  )}
                </form>
                <span className={s.count} aria-live="polite">
                  {loading ? t.loading : `${total} ${t.pieces}`}
                </span>
                <select
                  aria-label={t.sort}
                  className={s.sort}
                  value={sort}
                  onChange={(e) => setFilter("sort", e.target.value)}
                >
                  <option value="newest">{t.newest}</option>
                  <option value="price-asc">{t.priceAsc}</option>
                  <option value="price-desc">{t.priceDesc}</option>
                </select>
              </div>
            </>
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
        <dialog
          className={s.dialog}
          ref={dialog}
          aria-label={t.filters}
          onClick={(e) => {
            if (e.target === e.currentTarget) dialog.current?.close();
          }}
        >
          <div className={s.dialogInner}>
            <div className={s.dialogHead}>
              <h2>{t.filters}</h2>
              <button
                className={s.iconButton}
                aria-label={t.close}
                onClick={() => dialog.current?.close()}
              >
                <X size={24} weight="bold" />
              </button>
            </div>
            <fieldset className={s.filterGroup}>
              <legend>{t.size}</legend>
              <div className={s.sizeRow}>
                {sizes.map((value) => (
                  <button
                    className={`${s.sizeButton} ${size === value ? s.selectedSize : ""}`}
                    key={value}
                    onClick={() =>
                      setFilter("size", size === value ? "" : value)
                    }
                    aria-pressed={size === value}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className={s.filterGroup}>
              <legend>{t.price}</legend>
              <div className={s.priceInputs}>
                <label>
                  {t.from}
                  <input
                    inputMode="numeric"
                    type="number"
                    min="0"
                    value={min}
                    onChange={(e) => setFilter("minPrice", e.target.value)}
                  />
                </label>
                <span>—</span>
                <label>
                  {t.to}
                  <input
                    inputMode="numeric"
                    type="number"
                    min="0"
                    value={max}
                    onChange={(e) => setFilter("maxPrice", e.target.value)}
                  />
                </label>
              </div>
            </fieldset>
            <label className={s.checkbox}>
              <input
                type="checkbox"
                checked={available}
                onChange={(e) => setFilter("available", e.target.checked)}
              />
              <span>{t.available}</span>
            </label>
            <div className={s.dialogBottom}>
              <button
                className={s.primaryButton}
                onClick={() => dialog.current?.close()}
              >
                {t.apply}
                <ArrowRight size={20} />
              </button>
              <button className={s.textButton} onClick={reset}>
                {t.reset}
              </button>
            </div>
          </div>
        </dialog>
      </ProductQuickAddProvider>
    </ShopShell>
  );
}

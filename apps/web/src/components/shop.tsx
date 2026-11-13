"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bag,
  Globe,
  Check,
  Heart,
  MagnifyingGlass,
  MapPin,
  Minus,
  Plus,
  SlidersHorizontal,
  User,
  X,
  SignOut,
  Sneaker,
  Basketball,
  CoatHanger,
  TShirt,
  Pants,
  Beanie,
  Backpack,
  ShirtFolded,
  Sock,
  Sunglasses,
  SquaresFour,
  ThermometerCold,
  Hoodie,
  PersonSimpleRun,
  CaretLeft,
  CaretRight,
  type Icon,
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
import { InstallApp } from "./install-app";
import s from "./shop.module.css";
import { ensureVisitor } from "../lib/visitor-client";

export type { Product } from "@urbanmag/core";
export type ShopSettings = {
  address?: string;
  pickupAddress?: string;
  pickupCity?: string;
  pickupHours?: string;
  kazpostEnabled?: boolean;
  phone?: string;
  email?: string;
};
type Common = { locale: Locale; settings?: ShopSettings; initialCart?: Cart };
export type Cart = {
  id?: string;
  items: {
    variantId: string;
    quantity: number;
    size: string;
    product: Product;
  }[];
  total: number;
};
type Order = {
  id: string;
  number?: string;
  status: string;
  total: number;
  paymentStatus: string;
  isDemo?: boolean;
  simulationAllowed?: boolean;
  createdAt?: string;
  paymentUrl?: string;
  invoiceUrl?: string;
};
const emptyCart: Cart = { items: [], total: 0 };
const categoryIcons: Record<string, Icon> = {
  sneakers: Sneaker,
  "basketball-shoes": Basketball,
  outerwear: CoatHanger,
  hoodies: Hoodie,
  tracksuits: PersonSimpleRun,
  "t-shirts": TShirt,
  trousers: Pants,
  thermalwear: ThermometerCold,
  beanies: Beanie,
  backpacks: Backpack,
  shirts: ShirtFolded,
  sweatshirts: Hoodie,
  shorts: Pants,
  polos: TShirt,
  socks: Sock,
  vests: CoatHanger,
  accessories: Sunglasses,
};
const catalogCopy = {
  ru: {
    loadMore: "Показать ещё",
    shown: (shown: number, total: number) => `Показано ${shown} из ${total}`,
    previousPhoto: "Предыдущее фото",
    nextPhoto: "Следующее фото",
    photo: (index: number) => `Фото ${index}`,
    categories: "Категории",
  },
  kk: {
    loadMore: "Тағы көрсету",
    shown: (shown: number, total: number) =>
      `${total} ішінен ${shown} көрсетілді`,
    previousPhoto: "Алдыңғы сурет",
    nextPhoto: "Келесі сурет",
    photo: (index: number) => `${index}-сурет`,
    categories: "Санаттар",
  },
  en: {
    loadMore: "Show more",
    shown: (shown: number, total: number) => `Showing ${shown} of ${total}`,
    previousPhoto: "Previous photo",
    nextPhoto: "Next photo",
    photo: (index: number) => `Photo ${index}`,
    categories: "Categories",
  },
};
export type CatalogPagination = {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};
type CatalogPage = CatalogPagination & { products: Product[] };
async function request<T>(url: string, options?: RequestInit): Promise<T> {
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
function post<T>(url: string, data: unknown, method = "POST") {
  return request<T>(url, {
    method,
    body: JSON.stringify(data),
    keepalive: true,
  });
}
function localized(value: unknown, locale: Locale): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object")
    return String(
      (value as Record<string, unknown>)[locale] ||
        (value as Record<string, unknown>).ru ||
        "",
    );
  return "";
}
function pickupAddress(settings: ShopSettings | undefined, locale: Locale) {
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
function pickupHours(settings: ShopSettings | undefined, locale: Locale) {
  const hours = settings?.pickupHours;
  return hours === "График уточняется"
    ? {
        ru: hours,
        kk: "Жұмыс уақыты нақтылануда",
        en: "Opening hours to be confirmed",
      }[locale]
    : hours;
}
function useCart(initialCart?: Cart) {
  const [cart, setCart] = useState<Cart>(initialCart ?? emptyCart),
    [loading, setLoading] = useState(!initialCart),
    [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setError(false);
      setCart(await request<Cart>("/api/cart"));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    window.addEventListener("urbanmag:cart", refresh);
    return () => window.removeEventListener("urbanmag:cart", refresh);
  }, [refresh]);
  return { cart, setCart, loading, error, refresh };
}
function cartChanged() {
  window.dispatchEvent(new Event("urbanmag:cart"));
}

export function StoreHeader({ locale, initialCart }: Common) {
  const t = dictionary(locale);
  const path = usePathname();
  const [q, setQ] = useState("");
  const { cart } = useCart(initialCart);
  useEffect(() => {
    setQ(new URLSearchParams(window.location.search).get("q") || "");
  }, [path]);
  return (
    <>
      <a className={s.skip} href="#main">
        {t.skip}
      </a>
      <header className={s.header}>
        <div className={s.headerInner}>
          <Link
            prefetch={false}
            className={s.logo}
            href={`/${locale}`}
            aria-label="URBANMAG"
          >
            <span aria-hidden="true">
              URBAN<span className={s.logoSlash}>/</span>
            </span>
            <span aria-hidden="true">
              MAG<span className={s.logoDot}>●</span>
            </span>
          </Link>
          <nav className={s.desktopNav} aria-label={t.catalog}>
            <Link prefetch={false} href={`/${locale}`}>
              {t.new}
            </Link>
            <Link prefetch={false} href={`/${locale}?gender=men`}>
              {t.men}
            </Link>
            <Link prefetch={false} href={`/${locale}?gender=women`}>
              {t.women}
            </Link>
          </nav>
          <form className={s.headerSearch} action={`/${locale}`}>
            <MagnifyingGlass size={20} weight="bold" />
            <input
              aria-label={t.search}
              name="q"
              placeholder={t.searchPlaceholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit" aria-label={t.search}>
              <ArrowRight size={19} weight="bold" />
            </button>
          </form>
          <div className={s.headerActions}>
            <div
              className={`${s.languages} ${s.desktopLanguages}`}
              aria-label={t.language}
            >
              {(["ru", "kk", "en"] as Locale[]).map((l) => (
                <a
                  key={l}
                  href={path.replace(/^\/(ru|kk|en)(?=\/|\?|$)/, `/${l}`)}
                  hrefLang={l}
                  onClick={(e) => {
                    e.currentTarget.href = (
                      window.location.pathname + window.location.search
                    ).replace(/^\/(ru|kk|en)(?=\/|\?|$)/, `/${l}`);
                  }}
                  aria-current={locale === l ? "true" : undefined}
                >
                  {l.toUpperCase()}
                </a>
              ))}
            </div>
            <div className={s.languageControl}>
              <Globe size={24} weight="bold" aria-hidden="true" />
              <span aria-hidden="true">{locale.toUpperCase()}</span>
              <select
                className={s.mobileLanguage}
                aria-label={t.language}
                value={locale}
                onChange={(event) => {
                  window.location.href = (
                    window.location.pathname + window.location.search
                  ).replace(
                    /^\/(ru|kk|en)(?=\/|\?|$)/,
                    `/${event.target.value}`,
                  );
                }}
              >
                <option value="ru">RU</option>
                <option value="kk">KK</option>
                <option value="en">EN</option>
              </select>
            </div>
            <Link
              prefetch={false}
              href={`/${locale}/favorites`}
              className={s.iconButton}
              aria-label={t.favorites}
            >
              <Heart size={23} weight="bold" />
            </Link>
            <Link
              prefetch={false}
              href={`/${locale}/account`}
              className={`${s.iconButton} ${s.accountIcon}`}
              aria-label={t.account}
            >
              <User size={23} weight="bold" />
            </Link>
            <Link
              prefetch={false}
              href={`/${locale}/cart`}
              className={s.iconButton}
              aria-label={`${t.cart}${cart.items.length ? ` (${cart.items.reduce((n, i) => n + i.quantity, 0)})` : ""}`}
            >
              <Bag size={24} weight="bold" />
              {cart.items.length > 0 && (
                <span className={s.cartDot}>
                  {cart.items.reduce((n, i) => n + i.quantity, 0)}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>
      <nav className={s.bottomNav} aria-label={t.catalog}>
        {[
          {
            href: `/${locale}`,
            label: t.catalog,
            icon: SquaresFour,
            active:
              path === `/${locale}` ||
              path.startsWith(`/${locale}/c/`) ||
              path.startsWith(`/${locale}/p/`),
          },
          {
            href: `/${locale}/favorites`,
            label: t.favorites,
            icon: Heart,
            active: path.endsWith("/favorites"),
          },
          {
            href: `/${locale}/cart`,
            label: t.cart,
            icon: Bag,
            active: path.endsWith("/cart") || path.endsWith("/checkout"),
          },
          {
            href: `/${locale}/account`,
            label: t.account,
            icon: User,
            active: path.includes("/account"),
          },
        ].map(({ href, label, icon: NavIcon, active }) => (
          <Link
            key={href}
            href={href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
          >
            <span className={s.navIcon}>
              <NavIcon size={25} weight="bold" />
              {href.endsWith("/cart") && cart.items.length > 0 && (
                <span className={s.cartDot}>
                  {cart.items.reduce((n, item) => n + item.quantity, 0)}
                </span>
              )}
            </span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
export function StoreFooter({ locale, settings }: Common) {
  const t = dictionary(locale);
  return (
    <footer className={s.footer}>
      <div className={s.footerMain}>
        <Link prefetch={false} className={s.footerLogo} href={`/${locale}`}>
          URBAN/MAG
        </Link>
        <p>
          <MapPin size={17} weight="bold" />
          {pickupAddress(settings, locale)}
        </p>
        {settings?.email && (
          <a href={`mailto:${settings.email}`}>{settings.email}</a>
        )}
      </div>
      <nav className={s.footerCategories} aria-label={t.catalog}>
        {CATEGORIES.map((c) => (
          <Link prefetch={false} key={c.id} href={`/${locale}/c/${c.id}`}>
            {c.names[locale]}
          </Link>
        ))}
      </nav>
      <div className={s.footerBottom}>
        <span>© {new Date().getFullYear()} URBANMAG</span>
        <span>{t.cookieNote}</span>
        <Link prefetch={false} href={`/${locale}/cookies`}>
          {t.cookies} <ArrowRight size={14} />
        </Link>
      </div>
    </footer>
  );
}
export function ShopShell({
  children,
  locale,
  settings,
  initialCart,
}: Common & { children: ReactNode }) {
  return (
    <div className={s.shop}>
      <StoreHeader locale={locale} initialCart={initialCart} />
      <main id="main" className={s.main}>
        {children}
      </main>
      <InstallApp locale={locale} />
      <StoreFooter locale={locale} settings={settings} />
    </div>
  );
}

/** Bold category icons remain useful when a product photo is unavailable. */
export const ClothingArt = memo(function ClothingArt({
  product,
  className,
  locale = "ru",
}: {
  product: Product;
  className?: string;
  locale?: Locale;
  loading?: boolean;
}) {
  const id = `category-${useId().replace(/:/g, "")}`;
  const CategoryIcon = categoryIcons[product.category] ?? TShirt;
  return (
    <svg
      viewBox="0 0 256 256"
      className={className}
      role="img"
      aria-label={
        categoryName(locale, product.category) || product.names[locale]
      }
    >
      <defs>
        <mask
          id={id}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="256"
          height="256"
        >
          <CategoryIcon
            x="0"
            y="0"
            width="256"
            height="256"
            weight="bold"
            color="white"
          />
        </mask>
      </defs>
      <CategoryIcon
        x="0"
        y="0"
        width="256"
        height="256"
        weight="bold"
        color="#111"
      />
      <g mask={`url(#${id})`}>
        <rect
          className={s.gleam}
          x="-90"
          y="0"
          width="42"
          height="256"
          fill="white"
        />
      </g>
    </svg>
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
        loading={state === "loading"}
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
        {product.isDemo && <span className={s.demoTag}>{t.demo}</span>}
        {!stock && !product.isDemo && (
          <span className={s.demoTag}>{t.soldOut}</span>
        )}
      </div>
      <div className={s.productMeta}>
        <div>
          <p className={s.brand}>{product.brand}</p>
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

function Empty({
  title,
  hint,
  icon,
  children,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={s.empty}>
      {icon && <div className={s.emptyIcon}>{icon}</div>}
      <h2>{title}</h2>
      {hint && <p>{hint}</p>}
      {children}
    </div>
  );
}
function ErrorNotice({ text, action }: { text: string; action?: () => void }) {
  return (
    <p className={s.error} role="alert">
      {text}
      {action && (
        <button onClick={action}>
          <ArrowRight size={20} />
        </button>
      )}
    </p>
  );
}
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
    <ShopShell locale={locale} settings={settings}>
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
                  onClick={() => setFilter("size", size === value ? "" : value)}
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
    </ShopShell>
  );
}

export function ProductDetail({
  locale,
  product,
  settings,
}: Common & { product: Product }) {
  const t = dictionary(locale),
    copy = catalogCopy[locale];
  const [imageIndex, setImageIndex] = useState(0);
  const [variant, setVariant] = useState(""),
    [busy, setBusy] = useState(false),
    [added, setAdded] = useState(false),
    [error, setError] = useState(""),
    [favorite, setFavorite] = useState(false),
    [favoriteReady, setFavoriteReady] = useState(false),
    [favoritePending, setFavoritePending] = useState(false);
  const favoriteLock = useRef(false);
  const sizeGroup = useRef<HTMLDivElement>(null);
  const inStock = product.sizes.some((v) => v.available > 0);
  const name = product.names[locale] || product.names.ru;
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
    if (!variant) {
      setError(t.selectSize);
      sizeGroup.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      sizeGroup.current?.querySelector("button")?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      await post("/api/cart", { variantId: variant, quantity: 1 });
      setAdded(true);
      cartChanged();
    } catch {
      setError(t.cartError);
    } finally {
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
    <ShopShell locale={locale} settings={settings}>
      <div className={s.detailBreadcrumb}>
        <Link prefetch={false} href={`/${locale}`}>
          <ArrowLeft size={18} weight="bold" />
          {t.catalog}
        </Link>
        <span>
          {product.brand} / {name}
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
            {product.isDemo && <span className={s.detailDemo}>{t.demo}</span>}
            <span className={s.visualIndex}>
              URBANMAG / {product.category.toUpperCase()}
            </span>
            {product.media.length > 1 && (
              <div className={s.galleryArrows}>
                <button
                  className={s.iconButton}
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
            {product.brand}
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
          <h1>{name}</h1>
          <p className={s.detailPrice}>
            {money(product.price, locale)}
            {product.oldPrice && product.oldPrice > product.price && (
              <del>{money(product.oldPrice, locale)}</del>
            )}
          </p>
          {product.isDemo && <p className={s.note}>{t.demoHint}</p>}
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
                  disabled={!v.available}
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
              disabled={busy || !inStock}
            >
              {busy
                ? t.loading
                : !inStock
                  ? t.soldOut
                  : added
                    ? t.addedCart
                    : t.addCart}
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
          disabled={busy || !inStock}
        >
          {busy
            ? t.loading
            : !inStock
              ? t.soldOut
              : added
                ? t.addedCart
                : t.addCart}
          <Plus size={20} />
        </button>
      </div>
    </ShopShell>
  );
}

function PageTitle({
  title,
  aside,
  locale,
}: {
  title: string;
  aside?: ReactNode;
  locale: Locale;
}) {
  const t = dictionary(locale);
  return (
    <div className={s.pageTitle}>
      <div>
        <Link prefetch={false} className={s.backLink} href={`/${locale}`}>
          <ArrowLeft size={17} weight="bold" />
          {t.catalog}
        </Link>
        <h1>
          {title}
          <span className={s.titleDot}>.</span>
        </h1>
      </div>
      {aside}
    </div>
  );
}
function CartSummary({
  cart,
  locale,
  children,
}: {
  cart: Cart;
  locale: Locale;
  children?: ReactNode;
}) {
  const t = dictionary(locale);
  return (
    <aside className={s.summary}>
      <p className={s.eyebrow}>URBANMAG / {t.order}</p>
      <h2>
        {t.total}
        <span>{money(cart.total, locale)}</span>
      </h2>
      <p className={s.summaryCount}>
        {cart.items.reduce((a, i) => a + i.quantity, 0)} {t.pieces}
      </p>
      {children}
    </aside>
  );
}
export function CartView({ locale, settings, initialCart }: Common) {
  const t = dictionary(locale);
  const { cart, setCart, loading, error, refresh } = useCart(initialCart);
  const [busy, setBusy] = useState(""),
    [updateError, setUpdateError] = useState(false);
  async function update(variantId: string, quantity: number) {
    setBusy(variantId);
    try {
      const updated = await post<Cart>(
        "/api/cart",
        { variantId, quantity },
        "PATCH",
      );
      if (updated.items) setCart(updated);
      else await refresh();
      setUpdateError(false);
      cartChanged();
    } catch {
      setUpdateError(true);
    } finally {
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
                    <p className={s.brand}>{item.product.brand}</p>
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
                          disabled={
                            busy === item.variantId || item.quantity <= 1
                          }
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
                            busy === item.variantId ||
                            item.quantity >=
                              (item.product.sizes.find(
                                (v) => v.id === item.variantId,
                              )?.available || 999)
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
                        disabled={busy === item.variantId}
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

function statusLabel(order: Order, locale: Locale) {
  const t = dictionary(locale);
  if (order.paymentStatus === "paid") return t.paid;
  if (["canceled", "cancelled", "failed"].includes(order.status))
    return t.canceled;
  if (["pending", "created"].includes(order.status)) return t.awaitingPayment;
  return t.processing;
}
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
    if (!ready) return;
    setBusy(true);
    setFormError("");
    try {
      const created = await post<Order | { order: Order }>("/api/checkout", {
        email,
        phone,
        fulfillment: "pickup",
        expectedTotal: cart.total,
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
            {order.isDemo && <p className={s.note}>{t.orderDemo}</p>}
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

type AccountUser = {
  id: string;
  email: string;
  mustChangePassword?: boolean;
  requiresPasswordChange?: boolean;
  temporaryPassword?: boolean;
};
export function AccountView({ locale, settings }: Common) {
  const t = dictionary(locale);
  const [user, setUser] = useState<AccountUser | null>(null),
    [orders, setOrders] = useState<Order[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [currentPassword, setCurrentPassword] = useState(""),
    [newPassword, setNewPassword] = useState("");
  const load = useCallback(async () => {
    try {
      const data = await request<{ user: AccountUser | null }>("/api/auth/me");
      setUser(data.user);
      if (data.user && !data.user.mustChangePassword) {
        const result = await request<Order[] | { orders: Order[] }>(
          "/api/account/orders",
        );
        setOrders(Array.isArray(result) ? result : result.orders);
      }
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }, [t.error]);
  useEffect(() => {
    void load();
  }, [load]);
  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/api/auth/login", { email, password });
      setPassword("");
      await load();
    } catch {
      setError(t.authError);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await post("/api/auth/logout", {});
      setUser(null);
      setOrders([]);
      setNotice("");
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await post(
        "/api/auth/password",
        { currentPassword, newPassword },
        "PATCH",
      );
      setNotice(t.passwordSaved);
      setCurrentPassword("");
      setNewPassword("");
      await load();
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }
  const mustChange =
    user &&
    (user.mustChangePassword ||
      user.requiresPasswordChange ||
      user.temporaryPassword);
  return (
    <ShopShell locale={locale} settings={settings}>
      <section className={s.innerPage}>
        <PageTitle title={t.account} locale={locale} />
        {loading ? (
          <div className={s.loading}>{t.loading}</div>
        ) : !user ? (
          <div className={s.loginLayout}>
            <div className={s.loginIntro}>
              <span className={s.accountLargeIcon}>
                <User size={58} weight="bold" />
              </span>
              <h2>{t.loginHint}</h2>
              <p>{t.guestHint}</p>
            </div>
            <form className={s.loginForm} onSubmit={login}>
              <h2>{t.login}</h2>
              <Link
                prefetch={false}
                href={`/${locale}/reset`}
                className={s.textButton}
              >
                {locale === "ru"
                  ? "Забыли пароль?"
                  : locale === "kk"
                    ? "Құпиясөзді ұмыттыңыз ба?"
                    : "Forgot password?"}
              </Link>
              <label className={s.field}>
                {t.email}
                <input
                  aria-label={t.email}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className={s.field}>
                {t.password}
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {error && <ErrorNotice text={error} />}
              <button className={s.primaryButton} disabled={busy}>
                {busy ? t.loading : t.login}
                <ArrowRight size={20} />
              </button>
            </form>
          </div>
        ) : (
          <div className={s.accountLayout}>
            <aside className={s.accountSidebar}>
              <span className={s.accountAvatar}>
                <User size={35} weight="bold" />
              </span>
              <strong>{user.email}</strong>
              <button className={s.textButton} onClick={logout} disabled={busy}>
                {t.logout}
                <SignOut size={19} />
              </button>
            </aside>
            <div className={s.accountContent}>
              {error && <ErrorNotice text={error} />}
              <section className={s.accountSection}>
                <h2>
                  {t.orders}
                  <span>{orders.length.toString().padStart(2, "0")}</span>
                </h2>
                {orders.length ? (
                  <div className={s.orders}>
                    {orders.map((order) => (
                      <div className={s.orderRow} key={order.id}>
                        <div>
                          <strong>
                            #
                            {order.number || order.id.slice(0, 8).toUpperCase()}
                          </strong>
                          {order.createdAt && (
                            <time>
                              {new Date(order.createdAt).toLocaleDateString(
                                locale === "kk"
                                  ? "kk-KZ"
                                  : locale === "en"
                                    ? "en-GB"
                                    : "ru-RU",
                              )}
                            </time>
                          )}
                        </div>
                        <span
                          className={
                            order.paymentStatus === "paid"
                              ? s.paidStatus
                              : s.orderStatus
                          }
                        >
                          {statusLabel(order, locale)}
                        </span>
                        <strong>{money(order.total, locale)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={s.noOrders}>{t.noOrders}</p>
                )}
              </section>
              <section className={s.accountSection}>
                <h2>{t.changePassword}</h2>
                {mustChange && <p className={s.note}>{t.temporaryPassword}</p>}
                <form className={s.passwordForm} onSubmit={changePassword}>
                  <label className={s.field}>
                    {t.currentPassword}
                    <input
                      type="password"
                      autoComplete="current-password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </label>
                  <label className={s.field}>
                    {t.newPassword}
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <small>{t.passwordLength}</small>
                  </label>
                  {notice && (
                    <p className={s.saved} role="status">
                      <Check size={18} />
                      {notice}
                    </p>
                  )}
                  <button className={s.primaryButton} disabled={busy}>
                    {busy ? t.loading : t.save}
                    <ArrowRight size={20} />
                  </button>
                </form>
              </section>
            </div>
          </div>
        )}
      </section>
    </ShopShell>
  );
}

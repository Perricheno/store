"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRightIcon,
  PlusIcon,
  SignOutIcon,
  XIcon,
  PackageIcon,
  ShoppingBagIcon,
  GearIcon,
  UsersIcon,
  ArrowClockwiseIcon,
} from "@phosphor-icons/react";
import type { Product, Order, User, Settings } from "@urbanmag/core";
import s from "./dashboard.module.css";

type InventoryRow = {
  variantId: string;
  branchId: string;
  quantity: number;
  reserved: number;
  available: number;
};
type Job = {
  id: string;
  type: string;
  status: string;
  attempts: number;
  lastError?: string | null;
};

const dict = {
  ru: {
    productDetails: "Характеристики товара",
    addDetail: "Добавить характеристику",
    detailLabel: "Название характеристики",
    detailValue: "Значение",
    showDetail: "Показывать характеристику",
    removeDetail: "Удалить характеристику",
    detailHint:
      "Скрытые характеристики сохраняются, но не отображаются покупателям. Заполните название и значение на трёх языках.",
    productPromotion: "Акционный бейдж",
    showProductPromotion: "Показывать бейдж",
    badgeLabel: "Текст бейджа",
    badgePercent: "Процент (необязательно)",
    badgeHint:
      "Бейдж не изменяет цену товара. Процент — целое число от 1 до 99.",
    contentPages: "Страницы",
    contentPage: "Страница",
    pageAbout: "О магазине",
    pageDelivery: "Доставка и оплата",
    pageReturns: "Возврат",
    pagePrivacy: "Политика конфиденциальности",
    pageTerms: "Условия использования",
    announcement: "Объявление",
    banner: "Баннер",
    showPromotion: "Показывать на витрине",
    promotionLink: "Ссылка внутри магазина (необязательно)",
    bannerImage: "Изображение баннера",
    removeImage: "Удалить изображение",
    promotionHint: "Текст на всех трёх языках обязателен при включении.",
    workspace: "Команда",
    title: "Рабочее пространство",
    products: "Товары",
    searchProducts: "Поиск товаров",
    searchProductsHint: "Название, бренд или категория",
    previousPage: "Предыдущая",
    nextPage: "Следующая",
    pageLabel: "Страница",
    ofLabel: "из",
    noResults: "Товары не найдены",
    orders: "Заказы",
    settings: "Настройки",
    team: "Команда",
    add: "Добавить",
    login: "Войти",
    email: "Почта",
    password: "Пароль",
    logout: "Выйти",
    save: "Сохранить",
    cancel: "Отмена",
    close: "Закрыть",
    name: "Название",
    price: "Цена",
    stock: "Остаток",
    status: "Статус",
    edit: "Изменить",
    newProduct: "Новый товар",
    published: "Опубликован",
    draft: "Черновик",
    demo: "Демо",
    empty: "Пока пусто",
    loading: "Загрузка…",
    city: "Город",
    address: "Адрес самовывоза",
    hours: "Часы работы",
    shipping: "Казпочта — пока недоступно",
    emailLogin: "Вход для сотрудников",
    changePassword: "Смените временный пароль",
    newPassword: "Новый пароль, от 12 символов",
    category: "Категория",
    brand: "Бренд",
    sizes: "Размеры через запятую",
    color: "Название цвета",
    quantity: "Количество каждого размера",
    description: "Описание",
    kaspi: "Ссылка на Kaspi",
    photos: "Фотографии",
    slug: "Адрес товара",
    gender: "Для кого",
    all: "Унисекс",
    men: "Мужчинам",
    women: "Женщинам",
    oldPrice: "Прежняя цена",
    real: "Реальный товар",
    open: "Открыть магазин",
    refresh: "Обновить",
    customer: "Покупатель",
    role: "Роль",
    owner: "Владелец",
    manager: "Менеджер",
    addStaff: "Добавить сотрудника",
    payment: "Оплата",
    mail: "Почта",
    configured: "Настроено",
    notConfigured: "Не подключено",
    details: "Заказ",
    goNext: "Следующий статус",
    ready: "Готов к выдаче",
    completed: "Выдан",
    processing: "В сборке",
    paid: "Оплачен",
    awaiting_payment: "Ожидает оплаты",
    expired: "Истёк",
    cancelled: "Отменён",
    manual_review: "Требует проверки",
    refund_required: "Нужен возврат",
    refunded: "Возвращён",
    inventory: "Остатки по филиалам",
    branch: "Филиал",
    physical: "Физическое количество",
    reserved: "Зарезервировано",
    available: "Доступно",
    addBranch: "Добавить филиал",
    branchHint:
      "Латинские строчные буквы, цифры, дефис или подчёркивание (до 64 символов)",
    jobs: "Фоновые задачи",
    pending: "Ожидает",
    failed: "Ошибка",
    attempts: "Попытки",
    noJobs: "Нет ожидающих или завершившихся с ошибкой задач",
  },
  kk: {
    productDetails: "Тауар сипаттамалары",
    addDetail: "Сипаттама қосу",
    detailLabel: "Сипаттама атауы",
    detailValue: "Мәні",
    showDetail: "Сипаттаманы көрсету",
    removeDetail: "Сипаттаманы жою",
    detailHint:
      "Жасырын сипаттамалар сақталады, бірақ сатып алушыларға көрсетілмейді. Сипаттамалардың атауы мен мәнін үш тілде толтырыңыз.",
    productPromotion: "Акциялық белгі",
    showProductPromotion: "Белгіні көрсету",
    badgeLabel: "Белгі мәтіні",
    badgePercent: "Пайыз (міндетті емес)",
    badgeHint:
      "Белгі тауар бағасын өзгертпейді. Пайыз — 1 мен 99 арасындағы бүтін сан.",
    contentPages: "Беттер",
    contentPage: "Бет",
    pageAbout: "Дүкен туралы",
    pageDelivery: "Жеткізу және төлем",
    pageReturns: "Қайтару",
    pagePrivacy: "Құпиялық саясаты",
    pageTerms: "Пайдалану шарттары",
    announcement: "Хабарландыру",
    banner: "Баннер",
    showPromotion: "Дүкенде көрсету",
    promotionLink: "Дүкен ішіндегі сілтеме (міндетті емес)",
    bannerImage: "Баннер суреті",
    removeImage: "Суретті жою",
    promotionHint: "Қосылғанда үш тілдегі мәтін міндетті.",
    workspace: "Команда",
    title: "Жұмыс кеңістігі",
    products: "Тауарлар",
    searchProducts: "Тауарларды іздеу",
    searchProductsHint: "Атауы, мекенжайы, бренді немесе санаты",
    previousPage: "Алдыңғы",
    nextPage: "Келесі",
    pageLabel: "Бет",
    ofLabel: "барлығы",
    noResults: "Тауарлар табылмады",
    orders: "Тапсырыстар",
    settings: "Баптаулар",
    team: "Команда",
    add: "Қосу",
    login: "Кіру",
    email: "Пошта",
    password: "Құпиясөз",
    logout: "Шығу",
    save: "Сақтау",
    cancel: "Бас тарту",
    close: "Жабу",
    name: "Атауы",
    price: "Бағасы",
    stock: "Қалдық",
    status: "Күйі",
    edit: "Өзгерту",
    newProduct: "Жаңа тауар",
    published: "Жарияланған",
    draft: "Жоба",
    demo: "Демо",
    empty: "Әзірге бос",
    loading: "Жүктелуде…",
    city: "Қала",
    address: "Алып кету мекенжайы",
    hours: "Жұмыс уақыты",
    shipping: "Қазпошта — әзірге қолжетімсіз",
    emailLogin: "Қызметкерлердің кіруі",
    changePassword: "Уақытша құпиясөзді өзгертіңіз",
    newPassword: "Жаңа құпиясөз, кемінде 12 таңба",
    category: "Санат",
    brand: "Бренд",
    sizes: "Өлшемдер, үтір арқылы",
    color: "Түс атауы",
    quantity: "Әр өлшемнің саны",
    description: "Сипаттамасы",
    kaspi: "Kaspi сілтемесі",
    photos: "Фотосуреттер",
    slug: "Тауар мекенжайы",
    gender: "Кімге",
    all: "Унисекс",
    men: "Ерлерге",
    women: "Әйелдерге",
    oldPrice: "Алдыңғы бағасы",
    real: "Нақты тауар",
    open: "Дүкенді ашу",
    refresh: "Жаңарту",
    customer: "Сатып алушы",
    role: "Рөлі",
    owner: "Иесі",
    manager: "Менеджер",
    addStaff: "Қызметкер қосу",
    payment: "Төлем",
    mail: "Пошта",
    configured: "Бапталған",
    notConfigured: "Қосылмаған",
    details: "Тапсырыс",
    goNext: "Келесі күй",
    ready: "Алып кетуге дайын",
    completed: "Берілді",
    processing: "Жиналуда",
    paid: "Төленген",
    awaiting_payment: "Төлем күтілуде",
    expired: "Мерзімі өтті",
    cancelled: "Бас тартылды",
    manual_review: "Тексеру қажет",
    refund_required: "Қайтарым қажет",
    refunded: "Қайтарылды",
    inventory: "Филиалдардағы қалдықтар",
    branch: "Филиал",
    physical: "Нақты саны",
    reserved: "Резервте",
    available: "Қолжетімді",
    addBranch: "Филиал қосу",
    branchHint:
      "Кіші латын әріптері, сандар, дефис немесе астын сызу (64 таңбаға дейін)",
    jobs: "Фондық тапсырмалар",
    pending: "Күтілуде",
    failed: "Қате",
    attempts: "Әрекеттер",
    noJobs: "Күтіп тұрған немесе қатемен аяқталған тапсырмалар жоқ",
  },
  en: {
    productDetails: "Product characteristics",
    addDetail: "Add characteristic",
    detailLabel: "Characteristic name",
    detailValue: "Value",
    showDetail: "Show characteristic",
    removeDetail: "Remove characteristic",
    detailHint:
      "Hidden characteristics are saved but not shown to shoppers. Fill in the name and value in all three languages.",
    productPromotion: "Promotion badge",
    showProductPromotion: "Show badge",
    badgeLabel: "Badge text",
    badgePercent: "Percentage (optional)",
    badgeHint:
      "The badge does not change the product price. Percentage must be a whole number from 1 to 99.",
    contentPages: "Pages",
    contentPage: "Page",
    pageAbout: "About the store",
    pageDelivery: "Delivery and payment",
    pageReturns: "Returns",
    pagePrivacy: "Privacy policy",
    pageTerms: "Terms of use",
    announcement: "Announcement",
    banner: "Banner",
    showPromotion: "Show in storefront",
    promotionLink: "Store link (optional)",
    bannerImage: "Banner image",
    removeImage: "Remove image",
    promotionHint: "Text in all three languages is required when enabled.",
    workspace: "Team",
    title: "Workspace",
    products: "Products",
    searchProducts: "Search products",
    searchProductsHint: "Name, address, brand or category",
    previousPage: "Previous",
    nextPage: "Next",
    pageLabel: "Page",
    ofLabel: "of",
    noResults: "No products found",
    orders: "Orders",
    settings: "Settings",
    team: "Team",
    add: "Add",
    login: "Sign in",
    email: "Email",
    password: "Password",
    logout: "Sign out",
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    name: "Name",
    price: "Price",
    stock: "Stock",
    status: "Status",
    edit: "Edit",
    newProduct: "New product",
    published: "Published",
    draft: "Draft",
    demo: "Demo",
    empty: "Nothing here yet",
    loading: "Loading…",
    city: "City",
    address: "Pickup address",
    hours: "Opening hours",
    shipping: "Kazpost — currently unavailable",
    emailLogin: "Staff sign in",
    changePassword: "Change your temporary password",
    newPassword: "New password, at least 12 characters",
    category: "Category",
    brand: "Brand",
    sizes: "Sizes, separated by commas",
    color: "Color name",
    quantity: "Quantity per size",
    description: "Description",
    kaspi: "Kaspi URL",
    photos: "Photos",
    slug: "Product URL slug",
    gender: "For",
    all: "Unisex",
    men: "Men",
    women: "Women",
    oldPrice: "Previous price",
    real: "Real product",
    open: "Open store",
    refresh: "Refresh",
    customer: "Customer",
    role: "Role",
    owner: "Owner",
    manager: "Manager",
    addStaff: "Add staff member",
    payment: "Payments",
    mail: "Email",
    configured: "Configured",
    notConfigured: "Not connected",
    details: "Order",
    goNext: "Next status",
    ready: "Ready for pickup",
    completed: "Collected",
    processing: "Packing",
    paid: "Paid",
    awaiting_payment: "Awaiting payment",
    expired: "Expired",
    cancelled: "Cancelled",
    manual_review: "Needs review",
    refund_required: "Refund required",
    refunded: "Refunded",
    inventory: "Stock by branch",
    branch: "Branch",
    physical: "Physical quantity",
    reserved: "Reserved",
    available: "Available",
    addBranch: "Add branch",
    branchHint:
      "Lowercase Latin letters, numbers, hyphen or underscore (up to 64 characters)",
    jobs: "Background jobs",
    pending: "Pending",
    failed: "Failed",
    attempts: "Attempts",
    noJobs: "No pending or failed jobs",
  },
};
async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const r = await fetch(`/api/${path}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || "Request failed");
  return result;
}
const money = (n: number) => new Intl.NumberFormat("ru-KZ").format(n) + " ₸";

export function Dashboard() {
  const [lang, setLang] = useState<"ru" | "kk" | "en">("ru");
  const t = dict[lang];
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productPage, setProductPage] = useState(1);
  const searchTerm = productSearch.trim().toLocaleLowerCase();
  const filteredProducts = products.filter((p) =>
    [p.names[lang], p.slug, p.brand, p.category].some((value) =>
      value.toLocaleLowerCase().includes(searchTerm),
    ),
  );
  const productPages = Math.max(1, Math.ceil(filteredProducts.length / 24));
  const currentProductPage = Math.min(productPage, productPages);
  const visibleProducts = filteredProducts.slice(
    (currentProductPage - 1) * 24,
    currentProductPage * 24,
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [contentPage, setContentPage] = useState<
    "about" | "delivery" | "returns" | "privacy" | "terms"
  >("about");
  const [contentDraft, setContentDraft] = useState<Settings["contentPages"]>();
  const [bannerImage, setBannerImage] = useState<string | undefined>();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [integration, setIntegration] = useState<Record<string, unknown>>({});
  const [editing, setEditing] = useState<Product | null>(null);
  const [productDetails, setProductDetails] = useState<
    NonNullable<Product["details"]>
  >([]);
  const [productPromotion, setProductPromotion] = useState<
    NonNullable<Product["promotion"]>
  >({ enabled: false, label: { ru: "", kk: "", en: "" } });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const staffDialog = useRef<HTMLDialogElement>(null);
  const orderDialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState<string[]>([]);
  const inventoryDialog = useRef<HTMLDialogElement>(null);
  const [selectedVariant, setSelectedVariant] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  useEffect(() => {
    api<{ user: User | null }>("staff/auth/me")
      .then((r) => setUser(r.user))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  async function load() {
    if (!user || user.mustChangePassword) return;
    try {
      const [p, o, st, si] = await Promise.all([
        api<Product[]>("staff/products"),
        api<Order[]>("staff/orders"),
        api<Settings>("staff/settings"),
        api<Record<string, unknown>>("staff/status"),
      ]);
      setProducts(p);
      setOrders(o);
      setSettings(st);
      setIntegration(si);
      if (user.role === "owner") {
        const [staff, jobRows] = await Promise.all([
          api<User[]>("staff/users"),
          api<Job[]>("staff/jobs"),
        ]);
        setUsers(staff);
        setJobs(jobRows);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [user]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    await run(async () => {
      const result = await api<{ user: User }>("staff/auth/login", "POST", {
        email: data.get("email"),
        password: data.get("password"),
      });
      setUser(result.user);
    });
  }
  async function change(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    await run(async () => {
      const result = await api<{ user: User }>("staff/auth/password", "PATCH", {
        currentPassword: data.get("currentPassword"),
        newPassword: data.get("newPassword"),
      });
      setUser(result.user);
    });
  }
  const top = (
    <header className={s.top}>
      <a className={s.logo} href="/staff">
        URBAN<b>MAG</b>
        <small>{t.workspace}</small>
      </a>
      <div className={s.actions}>
        <select
          className={s.select}
          aria-label="Language"
          value={lang}
          onChange={(e) => setLang(e.target.value as typeof lang)}
        >
          <option value="ru">RU</option>
          <option value="kk">ҚАЗ</option>
          <option value="en">EN</option>
        </select>
        {user && (
          <>
            <span className={s.muted}>{user.email}</span>
            <button
              className={s.icon}
              aria-label={t.logout}
              onClick={() =>
                run(async () => {
                  await api("staff/auth/logout", "POST");
                  setUser(null);
                })
              }
            >
              <SignOutIcon size={22} weight="bold" />
            </button>
          </>
        )}
      </div>
    </header>
  );
  if (loading)
    return (
      <div className={s.page}>
        {top}
        <div className={s.loading}>{t.loading}</div>
      </div>
    );
  if (!user || user.mustChangePassword)
    return (
      <div className={s.page}>
        {top}
        <main className={s.center}>
          <p className={s.eyebrow}>Urbanmag / {t.workspace}</p>
          <h1>{user ? t.changePassword : t.emailLogin}</h1>
          <form className={s.form} onSubmit={user ? change : login}>
            {!user && (
              <label className={s.field}>
                {t.email}
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  className={s.input}
                  required
                />
              </label>
            )}
            <label className={s.field}>
              {t.password}
              <input
                name={user ? "currentPassword" : "password"}
                type="password"
                autoComplete="current-password"
                className={s.input}
                required
              />
            </label>
            {user && (
              <label className={s.field}>
                {t.newPassword}
                <input
                  name="newPassword"
                  type="password"
                  minLength={12}
                  autoComplete="new-password"
                  className={s.input}
                  required
                />
              </label>
            )}
            {error && (
              <p className={s.error} role="alert">
                {error}
              </p>
            )}
            <button className={`${s.button} ${s.primary}`} disabled={busy}>
              {user ? t.save : t.login}
            </button>
          </form>
        </main>
      </div>
    );
  async function openInventory(id: string, label: string) {
    setSelectedVariant({ id, label });
    setInventory([]);
    setInventoryLoaded(false);
    setError("");
    inventoryDialog.current?.showModal();
    await run(async () => {
      setInventory(await api<InventoryRow[]>("staff/inventory"));
      setInventoryLoaded(true);
    });
  }
  async function saveInventory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedVariant) return;
    const f = new FormData(e.currentTarget);
    const branchId = String(f.get("branchId"));
    const quantity = Number(f.get("quantity"));
    await run(async () => {
      await api("staff/inventory", "PATCH", {
        variantId: selectedVariant.id,
        branchId,
        quantity,
      });
      setInventory(await api<InventoryRow[]>("staff/inventory"));
      await load();
    });
  }
  function openProduct(product: Product | null) {
    setEditing(product);
    setProductDetails(
      (product?.details || []).map((detail) => ({
        ...detail,
        label: { ...detail.label },
        value: { ...detail.value },
      })),
    );
    setProductPromotion(
      product?.promotion
        ? { ...product.promotion, label: { ...product.promotion.label } }
        : { enabled: false, label: { ru: "", kk: "", en: "" } },
    );
    setMedia(product?.media || []);
    dialog.current?.showModal();
  }
  async function saveProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(async () => {
      const sizes = String(f.get("sizes"))
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((size) => ({
          id: editing?.sizes.find((v) => v.size === size)?.id,
          size,
          color: String(f.get("color") || "Black"),
          quantity: Number(f.get("quantity")),
        }));
      const saved = await api<Product>("staff/products", "POST", {
        id: editing?.id,
        slug: f.get("slug"),
        category: f.get("category"),
        gender: f.get("gender"),
        brand: f.get("brand"),
        names: {
          ru: f.get("name-ru"),
          kk: f.get("name-kk"),
          en: f.get("name-en"),
        },
        description: {
          ru: f.get("description-ru"),
          kk: f.get("description-kk"),
          en: f.get("description-en"),
        },
        details: productDetails,
        promotion: productPromotion,
        price: Number(f.get("price")),
        oldPrice: f.get("oldPrice") ? Number(f.get("oldPrice")) : undefined,
        media,
        kaspiUrl: f.get("kaspiUrl") || undefined,
        isDemo: editing?.isDemo ?? !f.get("real"),
        published: !!f.get("published"),
        sizes,
      });
      if (!editing) {
        for (const variant of saved.sizes)
          await api("staff/inventory", "PATCH", {
            variantId: variant.id,
            quantity: Number(f.get("quantity")),
          });
      }
      dialog.current?.close();
      await load();
    });
  }
  const next: Record<string, string> = {
    paid: "processing",
    processing: "ready",
    ready: "completed",
  };
  return (
    <div className={s.page}>
      {top}
      <main className={s.main}>
        <div className={s.heading}>
          <div>
            <p className={s.eyebrow}>
              Urbanmag / {user.role === "owner" ? t.owner : t.manager}
            </p>
            <h1>{t.title}</h1>
          </div>
          <button
            className={s.icon}
            onClick={() => run(load)}
            aria-label={t.refresh}
          >
            <ArrowClockwiseIcon size={20} weight="bold" />
          </button>
        </div>
        <nav className={s.tabs}>
          {(
            [
              ["products", PackageIcon],
              ["orders", ShoppingBagIcon],
              ["settings", GearIcon],
              ...(user.role === "owner" ? [["team", UsersIcon]] : []),
            ] as const
          ).map(([id, Icon]) => (
            <button
              key={String(id)}
              className={`${s.button} ${tab === id ? s.active : ""}`}
              onClick={() => {
                setTab(String(id));
                setError("");
                setNotice("");
              }}
            >
              <Icon size={18} weight="bold" />
              {t[id as keyof typeof t]}
            </button>
          ))}
        </nav>
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className={s.notice} role="status">
            {notice}
          </p>
        )}
        {tab === "products" && (
          <>
            <div className={s.heading}>
              <label className={`${s.field} ${s.productSearch}`}>
                {t.searchProducts}
                <input
                  className={s.input}
                  value={productSearch}
                  placeholder={t.searchProductsHint}
                  onChange={(event) => {
                    setProductSearch(event.target.value);
                    setProductPage(1);
                  }}
                />
              </label>
              <button
                className={`${s.button} ${s.primary}`}
                onClick={() => openProduct(null)}
              >
                <PlusIcon size={18} weight="bold" />
                {t.add}
              </button>
            </div>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{t.name}</th>
                    <th>{t.price}</th>
                    <th>{t.stock}</th>
                    <th>{t.status}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className={s.productName}>{p.names[lang]}</div>
                        <span className={s.muted}>
                          {p.brand} / {p.category}
                        </span>
                      </td>
                      <td>{money(p.price)}</td>
                      <td>
                        <div className={s.stock}>
                          {p.sizes.map((v) => (
                            <button
                              key={v.id}
                              onClick={() =>
                                void openInventory(
                                  v.id,
                                  `${p.names[lang]} · ${v.size}`,
                                )
                              }
                            >
                              {v.size} · {v.available}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={`${s.pill} ${p.isDemo ? s.warn : ""}`}>
                          {p.isDemo
                            ? t.demo
                            : p.published
                              ? t.published
                              : t.draft}
                        </span>
                      </td>
                      <td>
                        <button
                          className={s.button}
                          onClick={() => openProduct(p)}
                        >
                          {t.edit}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredProducts.length === 0 && (
              <p className={s.muted}>{t.noResults}</p>
            )}
            <nav className={s.pagination} aria-label={t.products}>
              <span aria-live="polite">
                {filteredProducts.length} / {t.products} · {t.pageLabel}{" "}
                {currentProductPage} {t.ofLabel} {productPages}
              </span>
              <div>
                <button
                  className={s.button}
                  type="button"
                  disabled={currentProductPage <= 1}
                  onClick={() => setProductPage(currentProductPage - 1)}
                >
                  {t.previousPage}
                </button>
                <button
                  className={s.button}
                  type="button"
                  disabled={currentProductPage >= productPages}
                  onClick={() => setProductPage(currentProductPage + 1)}
                >
                  {t.nextPage}
                </button>
              </div>
            </nav>
          </>
        )}
        {tab === "orders" && (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>№</th>
                  <th>{t.customer}</th>
                  <th>{t.price}</th>
                  <th>{t.status}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      {o.id.slice(0, 8).toUpperCase()}
                      <div className={s.muted}>
                        {new Date(o.createdAt).toLocaleDateString(
                          lang === "kk" ? "kk-KZ" : lang,
                        )}
                      </div>
                    </td>
                    <td>{o.email}</td>
                    <td>{money(o.total)}</td>
                    <td>
                      <span
                        className={`${s.pill} ${o.status === "manual_review" ? s.warn : ""}`}
                      >
                        {t[o.status as keyof typeof t] || o.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className={s.button}
                        onClick={() => {
                          setSelectedOrder(o);
                          orderDialog.current?.showModal();
                        }}
                      >
                        {t.details}
                        <ArrowUpRightIcon size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!orders.length && <div className={s.empty}>{t.empty}</div>}
          </div>
        )}
        {tab === "settings" && settings && (
          <div className={s.grid}>
            <form
              className={`${s.card} ${s.form}`}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  setSettings(
                    await api("staff/settings", "PATCH", {
                      pickupCity: f.get("pickupCity"),
                      pickupAddress: f.get("pickupAddress"),
                      pickupHours: f.get("pickupHours"),
                      kazpostEnabled: false,
                      contentPages: contentDraft ?? settings.contentPages,
                      announcement: {
                        enabled: f.get("announcementEnabled") === "on",
                        text: Object.fromEntries(
                          (["ru", "kk", "en"] as const).map((language) => [
                            language,
                            String(f.get(`announcement_${language}`) || ""),
                          ]),
                        ),
                        href: String(f.get("announcementHref") || ""),
                      },
                      banner: {
                        enabled: f.get("bannerEnabled") === "on",
                        title: Object.fromEntries(
                          (["ru", "kk", "en"] as const).map((language) => [
                            language,
                            String(f.get(`banner_${language}`) || ""),
                          ]),
                        ),
                        href: String(f.get("bannerHref") || ""),
                        imageUrl:
                          (bannerImage ?? settings.banner?.imageUrl) ||
                          undefined,
                      },
                    }),
                  );
                  setNotice(t.save);
                });
              }}
            >
              <h3>{t.settings}</h3>
              {(["pickupCity", "pickupAddress", "pickupHours"] as const).map(
                (key, i) => (
                  <label className={s.field} key={key}>
                    {[t.city, t.address, t.hours][i]}
                    <input
                      name={key}
                      className={s.input}
                      defaultValue={settings[key]}
                      disabled={user.role !== "owner"}
                      required
                    />
                  </label>
                ),
              )}
              {(["announcement", "banner"] as const).map((kind) => (
                <fieldset
                  className={s.promotionFields}
                  key={kind}
                  disabled={user.role !== "owner" || busy}
                >
                  <legend>{t[kind]}</legend>
                  <label className={s.checks}>
                    <input
                      type="checkbox"
                      name={`${kind}Enabled`}
                      defaultChecked={settings[kind]?.enabled ?? false}
                    />
                    {t.showPromotion}
                  </label>
                  <p className={s.muted}>{t.promotionHint}</p>
                  {(["ru", "kk", "en"] as const).map((language) => (
                    <label className={s.field} key={language}>
                      {language.toUpperCase()}
                      <input
                        className={s.input}
                        name={`${kind}_${language}`}
                        maxLength={300}
                        defaultValue={
                          kind === "announcement"
                            ? settings.announcement?.text[language]
                            : settings.banner?.title[language]
                        }
                      />
                    </label>
                  ))}
                  <label className={s.field}>
                    {t.promotionLink}
                    <input
                      className={s.input}
                      name={`${kind}Href`}
                      maxLength={500}
                      placeholder="/ru"
                      defaultValue={settings[kind]?.href}
                    />
                  </label>
                  {kind === "banner" && (
                    <>
                      <label className={s.field}>
                        {t.bannerImage}
                        <input
                          className={s.input}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif"
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            await run(async () => {
                              const form = new FormData();
                              form.set("file", file);
                              const response = await fetch(
                                "/api/staff/uploads",
                                { method: "POST", body: form },
                              );
                              const data = await response.json();
                              if (!response.ok) throw new Error(data.error);
                              setBannerImage(data.url);
                            });
                            event.target.value = "";
                          }}
                        />
                      </label>
                      {(bannerImage ?? settings.banner?.imageUrl) && (
                        <div className={s.bannerPreview}>
                          <img
                            src={bannerImage ?? settings.banner?.imageUrl}
                            alt=""
                          />
                          <button
                            type="button"
                            className={s.button}
                            onClick={() => {
                              setBannerImage("");
                              setSettings((current) =>
                                current
                                  ? {
                                      ...current,
                                      banner: current.banner
                                        ? {
                                            ...current.banner,
                                            imageUrl: undefined,
                                          }
                                        : undefined,
                                    }
                                  : current,
                              );
                            }}
                          >
                            {t.removeImage}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </fieldset>
              ))}
              <details className={s.contentEditor}>
                <summary>{t.contentPages}</summary>
                <label className={s.field}>
                  {t.contentPage}
                  <select
                    className={s.select}
                    value={contentPage}
                    onChange={(event) =>
                      setContentPage(event.target.value as typeof contentPage)
                    }
                  >
                    {(
                      [
                        "about",
                        "delivery",
                        "returns",
                        "privacy",
                        "terms",
                      ] as const
                    ).map((key, index) => (
                      <option value={key} key={key}>
                        {
                          [
                            t.pageAbout,
                            t.pageDelivery,
                            t.pageReturns,
                            t.pagePrivacy,
                            t.pageTerms,
                          ][index]
                        }
                      </option>
                    ))}
                  </select>
                </label>
                {(["ru", "kk", "en"] as const).map((language) => (
                  <label className={s.field} key={language}>
                    {language.toUpperCase()}
                    <textarea
                      className={s.input}
                      name={`content_${contentPage}_${language}`}
                      rows={6}
                      maxLength={20000}
                      disabled={user.role !== "owner" || busy}
                      value={
                        (contentDraft ?? settings.contentPages)?.[
                          contentPage
                        ]?.[language] ?? ""
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        setContentDraft((current) => {
                          const pages = current ?? settings.contentPages ?? {};
                          return {
                            ...pages,
                            [contentPage]: {
                              ru: "",
                              kk: "",
                              en: "",
                              ...pages[contentPage],
                              [language]: value,
                            },
                          };
                        });
                      }}
                    />
                  </label>
                ))}
              </details>
              <p className={s.muted}>{t.shipping}</p>
              {user.role === "owner" && (
                <button className={`${s.button} ${s.primary}`} disabled={busy}>
                  {t.save}
                </button>
              )}
            </form>
            <div className={s.card}>
              <h3>{t.payment}</h3>
              <p className={s.metrics}>
                {String(integration.paymentMode || "—").toUpperCase()}
              </p>
              <p className={s.muted}>
                {integration.apiPayConfigured ? t.configured : t.notConfigured}
              </p>
            </div>
            <div className={s.card}>
              <h3>{t.mail}</h3>
              <p className={s.metrics}>
                {integration.smtpConfigured ? "SMTP" : "—"}
              </p>
              <p className={s.muted}>
                {integration.smtpConfigured ? t.configured : t.notConfigured}
              </p>
            </div>
            {user.role === "owner" && (
              <section className={`${s.card} ${s.jobs}`}>
                <h3>{t.jobs}</h3>
                {jobs.filter(
                  (job) => job.status === "pending" || job.status === "failed",
                ).length === 0 ? (
                  <p className={s.muted}>{t.noJobs}</p>
                ) : (
                  jobs
                    .filter(
                      (job) =>
                        job.status === "pending" || job.status === "failed",
                    )
                    .map((job) => (
                      <div className={s.job} key={job.id}>
                        <div>
                          <strong>{job.type}</strong>{" "}
                          <span
                            className={`${s.pill} ${job.status === "failed" ? s.warn : ""}`}
                          >
                            {job.status === "failed" ? t.failed : t.pending}
                          </span>
                          <p className={s.muted}>
                            {job.id} · {t.attempts}: {job.attempts}
                          </p>
                        </div>
                        {job.lastError && (
                          <p className={s.jobError}>{job.lastError}</p>
                        )}
                      </div>
                    ))
                )}
              </section>
            )}
          </div>
        )}
        {tab === "team" && user.role === "owner" && (
          <>
            <div className={s.heading}>
              <p className={s.muted}>
                {users.length} / {t.team}
              </p>
              <button
                className={`${s.button} ${s.primary}`}
                onClick={() => staffDialog.current?.showModal()}
              >
                <PlusIcon size={18} />
                {t.addStaff}
              </button>
            </div>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{t.email}</th>
                    <th>{t.role}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>
                        <span className={s.pill}>
                          {u.role === "owner"
                            ? t.owner
                            : u.role === "manager"
                              ? t.manager
                              : t.customer}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <footer className={s.foot}>
          <span>URBANMAG © {new Date().getFullYear()}</span>
          <a href={process.env.NEXT_PUBLIC_SHOP_URL || "/ru"}>{t.open} ↗</a>
        </footer>
      </main>
      <dialog ref={dialog} className={s.dialog}>
        <div className={s.dialogHead}>
          <h2>{editing ? t.edit : t.newProduct}</h2>
          <button
            className={s.icon}
            aria-label={t.close}
            onClick={() => dialog.current?.close()}
          >
            <XIcon size={20} weight="bold" />
          </button>
        </div>
        <form
          onSubmit={saveProduct}
          className={s.form}
          key={editing?.id || "new"}
        >
          {(["ru", "kk", "en"] as const).map((l) => (
            <label className={s.field} key={l}>
              {t.name} · {l.toUpperCase()}
              <input
                name={`name-${l}`}
                className={s.input}
                defaultValue={editing?.names[l]}
                required
                maxLength={200}
              />
            </label>
          ))}
          <div className={s.row}>
            <label className={s.field}>
              {t.slug}
              <input
                name="slug"
                className={s.input}
                defaultValue={editing?.slug}
                required
                pattern="[a-z0-9-]+"
              />
            </label>
            <label className={s.field}>
              {t.brand}
              <input
                name="brand"
                className={s.input}
                defaultValue={editing?.brand || "Urbanmag"}
                required
              />
            </label>
          </div>
          <div className={s.row}>
            <label className={s.field}>
              {t.category}
              <select
                name="category"
                className={s.select}
                defaultValue={editing?.category || "outerwear"}
              >
                {[
                  "outerwear",
                  "sneakers",
                  "hoodies",
                  "t-shirts",
                  "shirts",
                  "trousers",
                  "accessories",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className={s.field}>
              {t.gender}
              <select
                name="gender"
                className={s.select}
                defaultValue={editing?.gender || "unisex"}
              >
                <option value="unisex">{t.all}</option>
                <option value="men">{t.men}</option>
                <option value="women">{t.women}</option>
              </select>
            </label>
          </div>
          <div className={s.row}>
            <label className={s.field}>
              {t.price}
              <input
                type="number"
                min={1}
                step={1}
                name="price"
                className={s.input}
                defaultValue={editing?.price}
                required
              />
            </label>
            <label className={s.field}>
              {t.oldPrice}
              <input
                type="number"
                min={1}
                step={1}
                name="oldPrice"
                className={s.input}
                defaultValue={editing?.oldPrice}
              />
            </label>
          </div>
          <label className={s.field}>
            {t.sizes}
            <input
              name="sizes"
              className={s.input}
              defaultValue={
                editing?.sizes.map((v) => v.size).join(", ") || "S, M, L, XL"
              }
              required
            />
          </label>
          <div className={s.row}>
            <label className={s.field}>
              {t.color}
              <input
                name="color"
                className={s.input}
                defaultValue={editing?.sizes[0]?.color || "Black"}
                required
              />
            </label>
            {!editing && (
              <label className={s.field}>
                {t.quantity}
                <input
                  name="quantity"
                  type="number"
                  min={0}
                  step={1}
                  className={s.input}
                  defaultValue={5}
                  required
                />
              </label>
            )}
          </div>
          {(["ru", "kk", "en"] as const).map((l) => (
            <label className={s.field} key={l}>
              {t.description} · {l.toUpperCase()}
              <textarea
                name={`description-${l}`}
                className={s.input}
                defaultValue={editing?.description[l] || ""}
              />
            </label>
          ))}
          <fieldset className={s.productFields} disabled={busy}>
            <legend>{t.productDetails}</legend>
            <p className={s.fieldHint}>{t.detailHint}</p>
            {productDetails.map((detail, index) => (
              <fieldset className={s.detailRow} key={detail.key}>
                <legend>
                  {t.productDetails} · {index + 1}
                </legend>
                <div className={s.detailActions}>
                  <label className={s.detailToggle}>
                    <input
                      type="checkbox"
                      checked={detail.enabled}
                      onChange={(event) =>
                        setProductDetails((rows) =>
                          rows.map((row) =>
                            row.key === detail.key
                              ? { ...row, enabled: event.target.checked }
                              : row,
                          ),
                        )
                      }
                    />
                    {t.showDetail}
                  </label>
                  <button
                    type="button"
                    className={s.button}
                    aria-label={`${t.removeDetail} ${index + 1}`}
                    onClick={() =>
                      setProductDetails((rows) =>
                        rows.filter((row) => row.key !== detail.key),
                      )
                    }
                  >
                    {t.removeDetail}
                  </button>
                </div>
                {(["ru", "kk", "en"] as const).map((locale) => (
                  <div className={s.row} key={locale}>
                    <label className={s.field}>
                      {t.detailLabel} · {locale.toUpperCase()}
                      <input
                        className={s.input}
                        value={detail.label[locale]}
                        required
                        maxLength={100}
                        onChange={(event) =>
                          setProductDetails((rows) =>
                            rows.map((row) =>
                              row.key === detail.key
                                ? {
                                    ...row,
                                    label: {
                                      ...row.label,
                                      [locale]: event.target.value,
                                    },
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className={s.field}>
                      {t.detailValue} · {locale.toUpperCase()}
                      <input
                        className={s.input}
                        value={detail.value[locale]}
                        required
                        maxLength={500}
                        onChange={(event) =>
                          setProductDetails((rows) =>
                            rows.map((row) =>
                              row.key === detail.key
                                ? {
                                    ...row,
                                    value: {
                                      ...row.value,
                                      [locale]: event.target.value,
                                    },
                                  }
                                : row,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                ))}
              </fieldset>
            ))}
            <button
              type="button"
              className={s.button}
              disabled={productDetails.length >= 12}
              onClick={() =>
                setProductDetails((rows) => [
                  ...rows,
                  {
                    key: `detail_${crypto.randomUUID()}`,
                    enabled: true,
                    label: { ru: "", kk: "", en: "" },
                    value: { ru: "", kk: "", en: "" },
                  },
                ])
              }
            >
              <PlusIcon size={18} aria-hidden="true" />
              {t.addDetail}
            </button>
          </fieldset>
          <fieldset className={s.productFields} disabled={busy}>
            <legend>{t.productPromotion}</legend>
            <label className={s.detailToggle}>
              <input
                type="checkbox"
                checked={productPromotion.enabled}
                onChange={(event) =>
                  setProductPromotion((promotion) => ({
                    ...promotion,
                    enabled: event.target.checked,
                  }))
                }
              />
              {t.showProductPromotion}
            </label>
            {(["ru", "kk", "en"] as const).map((locale) => (
              <label className={s.field} key={locale}>
                {t.badgeLabel} · {locale.toUpperCase()}
                <input
                  className={s.input}
                  value={productPromotion.label[locale]}
                  required={productPromotion.enabled}
                  maxLength={80}
                  onChange={(event) =>
                    setProductPromotion((promotion) => ({
                      ...promotion,
                      label: {
                        ...promotion.label,
                        [locale]: event.target.value,
                      },
                    }))
                  }
                />
              </label>
            ))}
            <label className={s.field}>
              {t.badgePercent}
              <input
                className={s.input}
                type="number"
                min={1}
                max={99}
                step={1}
                value={productPromotion.percent ?? ""}
                onChange={(event) =>
                  setProductPromotion((promotion) => ({
                    ...promotion,
                    percent:
                      event.target.value === ""
                        ? undefined
                        : Number(event.target.value),
                  }))
                }
              />
            </label>
            <p className={s.fieldHint}>{t.badgeHint}</p>
          </fieldset>
          <label className={s.field}>
            {t.kaspi}
            <input
              type="url"
              name="kaspiUrl"
              className={s.input}
              defaultValue={editing?.kaspiUrl}
            />
          </label>
          <label className={s.field}>
            {t.photos}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                await run(async () => {
                  const form = new FormData();
                  form.set("file", file);
                  const r = await fetch("/api/staff/uploads", {
                    method: "POST",
                    body: form,
                  });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error);
                  setMedia((current) => [...current, d.url]);
                });
              }}
            />
          </label>
          <div className={s.images}>
            {media.map((url) => (
              <button
                type="button"
                key={url}
                className={s.icon}
                onClick={() => setMedia((v) => v.filter((p) => p !== url))}
                style={{ width: 70, height: 80, padding: 3 }}
                aria-label={t.cancel}
              >
                <img src={url} alt="" />
              </button>
            ))}
          </div>
          <label className={s.checks}>
            <input
              type="checkbox"
              name="published"
              defaultChecked={editing?.published ?? false}
            />
            {t.published}
          </label>
          {!editing && (
            <label className={s.checks}>
              <input type="checkbox" name="real" />
              {t.real}
            </label>
          )}
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
          <button className={`${s.button} ${s.primary}`} disabled={busy}>
            {t.save}
          </button>
        </form>
      </dialog>
      <dialog
        ref={inventoryDialog}
        className={s.dialog}
        aria-labelledby="inventory-title"
        onClose={() => {
          setSelectedVariant(null);
          setError("");
        }}
      >
        <div className={s.dialogHead}>
          <div>
            <h2 id="inventory-title">{t.inventory}</h2>
            <p className={s.muted}>{selectedVariant?.label}</p>
          </div>
          <button
            type="button"
            className={s.icon}
            aria-label={t.close}
            onClick={() => inventoryDialog.current?.close()}
          >
            <XIcon size={20} />
          </button>
        </div>
        {selectedVariant && (
          <>
            <div className={s.inventoryList}>
              {inventory
                .filter((row) => row.variantId === selectedVariant.id)
                .map((row) => (
                  <form
                    className={s.inventoryRow}
                    key={row.branchId}
                    onSubmit={saveInventory}
                  >
                    <input type="hidden" name="branchId" value={row.branchId} />
                    <div>
                      <strong>{row.branchId}</strong>
                      <p className={s.muted}>
                        {t.reserved}: {row.reserved} · {t.available}:{" "}
                        {row.available}
                      </p>
                    </div>
                    <label className={s.field}>
                      {t.physical}
                      <input
                        className={s.input}
                        name="quantity"
                        type="number"
                        min={row.reserved}
                        step={1}
                        defaultValue={row.quantity}
                        required
                        disabled={busy}
                        key={row.quantity}
                      />
                    </label>
                    <button
                      className={`${s.button} ${s.primary}`}
                      disabled={busy}
                    >
                      {t.save}
                    </button>
                  </form>
                ))}
            </div>
            {busy && !inventoryLoaded && <p className={s.muted}>{t.loading}</p>}
            {inventoryLoaded && (
              <form className={s.form} onSubmit={saveInventory}>
                <h3>{t.addBranch}</h3>
                <label className={s.field}>
                  {t.branch}
                  <input
                    className={s.input}
                    name="branchId"
                    pattern="[a-z0-9_-]{1,64}"
                    maxLength={64}
                    title={t.branchHint}
                    required
                    disabled={busy}
                  />
                  <span className={s.muted}>{t.branchHint}</span>
                </label>
                <label className={s.field}>
                  {t.physical}
                  <input
                    className={s.input}
                    name="quantity"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={0}
                    required
                    disabled={busy}
                  />
                </label>
                <button className={`${s.button} ${s.primary}`} disabled={busy}>
                  {t.save}
                </button>
              </form>
            )}
            {error && (
              <p className={s.error} role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </dialog>
      <dialog ref={staffDialog} className={s.dialog}>
        <div className={s.dialogHead}>
          <h2>{t.addStaff}</h2>
          <button
            className={s.icon}
            aria-label={t.close}
            onClick={() => staffDialog.current?.close()}
          >
            <XIcon size={20} />
          </button>
        </div>
        <form
          className={s.form}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              await api("staff/users", "POST", {
                email: f.get("email"),
                password: f.get("password"),
                role: f.get("role"),
              });
              staffDialog.current?.close();
              await load();
            });
          }}
        >
          <label className={s.field}>
            {t.email}
            <input type="email" name="email" className={s.input} required />
          </label>
          <label className={s.field}>
            {t.newPassword}
            <input
              type="password"
              name="password"
              minLength={12}
              className={s.input}
              required
            />
          </label>
          <label className={s.field}>
            {t.role}
            <select name="role" className={s.select}>
              <option value="manager">{t.manager}</option>
              <option value="owner">{t.owner}</option>
            </select>
          </label>
          {error && <p className={s.error}>{error}</p>}
          <button className={`${s.button} ${s.primary}`} disabled={busy}>
            {t.add}
          </button>
        </form>
      </dialog>
      <dialog ref={orderDialog} className={s.dialog}>
        <div className={s.dialogHead}>
          <h2>
            {t.details} {selectedOrder?.id.slice(0, 8).toUpperCase()}
          </h2>
          <button
            className={s.icon}
            aria-label={t.close}
            onClick={() => orderDialog.current?.close()}
          >
            <XIcon size={20} />
          </button>
        </div>
        {selectedOrder && (
          <>
            <p>{selectedOrder.email}</p>
            <span className={s.pill}>
              {t[selectedOrder.status as keyof typeof t] ||
                selectedOrder.status}
            </span>
            {selectedOrder.lines.map((l, i) => (
              <div className={s.line} key={i}>
                <span>
                  {l.names[lang]} · {l.size} × {l.quantity}
                </span>
                <b>{money(l.price * l.quantity)}</b>
              </div>
            ))}
            <p className={s.total}>{money(selectedOrder.total)}</p>
            {next[selectedOrder.status] && (
              <button
                className={`${s.button} ${s.primary}`}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api(`staff/orders/${selectedOrder.id}`, "PATCH", {
                      status: next[selectedOrder.status],
                    });
                    orderDialog.current?.close();
                    await load();
                  })
                }
              >
                {t[next[selectedOrder.status] as keyof typeof t] || t.goNext}
              </button>
            )}
            {error && <p className={s.error}>{error}</p>}
          </>
        )}
      </dialog>
    </div>
  );
}

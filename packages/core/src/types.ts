export type Locale = "ru" | "kk" | "en";
export type Translations = Record<Locale, string>;
export type Role = "customer" | "manager" | "owner";
export interface User {
  id: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
}
export interface ProductDetail {
  key: string;
  label: Translations;
  value: Translations;
  enabled: boolean;
}
export interface ProductPromotion {
  enabled: boolean;
  label: Translations;
  percent?: number;
}
export interface Product {
  id: string;
  slug: string;
  category: string;
  gender: string;
  brand: string;
  article?: string;
  names: Translations;
  description: Translations;
  details: ProductDetail[];
  promotion?: ProductPromotion;
  price: number;
  oldPrice?: number;
  media: string[];
  sizes: Array<{ id: string; size: string; color: string; available: number; barcode?: string }>;
  kaspiUrl?: string;
  isDemo: boolean;
  published: boolean;
  createdAt: string;
}
export interface CartItem {
  variantId: string;
  quantity: number;
  product: Product;
  size: string;
  color: string;
  available: number;
  lineTotal: number;
}
export interface Cart {
  items: CartItem[];
  total: number;
  count: number;
}
export interface OrderLine {
  /** Historical category snapshot; absent on legacy orders. */
  category?: string;
  productId: string;
  variantId: string;
  name: string;
  names: Translations;
  size: string;
  color: string;
  price: number;
  quantity: number;
  media: string[];
  isDemo: boolean;
}
export interface Order {
  id: string;
  status: string;
  total: number;
  lines: OrderLine[];
  email: string;
  phone: string;
  fulfillment: "pickup";
  locale: Locale;
  createdAt: string;
  expiresAt: string;
  paymentUrl?: string;
  paymentStatus?: string;
  paymentMethod?: "apipay" | "wallet";
}
export interface Settings {
  contentPages?: Partial<
    Record<
      "about" | "delivery" | "returns" | "privacy" | "terms",
      Record<Locale, string>
    >
  >;
  announcement?: {
    enabled: boolean;
    text: Record<Locale, string>;
    href?: string;
  };
  banner?: {
    enabled: boolean;
    title: Record<Locale, string>;
    imageUrl?: string;
    href?: string;
  };
  pickupCity: string;
  pickupAddress: string;
  pickupHours: string;
  kazpostEnabled: false;
}
export interface Job {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
}
export class CoreError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "CoreError";
  }
}

export interface CatalogPage {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Public responses omit disabled fields while staff records retain editable values. */
export function publicProduct(product: Product): Product {
  const { promotion, ...rest } = product;
  return {
    ...rest,
    details: product.details.filter((detail) => detail.enabled),
    ...(promotion?.enabled ? { promotion } : {}),
  };
}

export interface StaffInsights {
  generatedAt: string;
  period: { days: 7 | 30 | 90 | 365; from: string; to: string; timezone: "Asia/Almaty" };
  revenue: { completedAmount: number; completedOrders: number; averageCompletedOrder: number | null };
  pipeline: { paidAmount: number; paidOrders: number };
  orders: { created: number; byStatus: Record<string, number> };
  catalog: { realProducts: number; demoProducts: number; publishedRealProducts: number };
  inventory: { availableUnits: number; reservedUnits: number; lowVariants: number; outVariants: number; alerts: Array<{ variantId: string; productId: string; names: Translations; size: string; color: string; available: number }> };
  daily: Array<{ date: string; createdOrders: number; completedOrders: number; completedAmount: number }>;
  topProducts: Array<{ productId: string; names: Translations; units: number; amount: number }>;
  categorySales: Array<{ category: string | null; units: number; amount: number }>;
  /** History counts are all-time; linesWithoutCategory covers sales in the selected period. */
  quality: { allOrders: number; verifiedRealOrders: number; demoOrders: number; sandboxOrders: number; unverifiedOrders: number; completedWithoutTimestamp: number; linesWithoutCategory: number; partialRefundOrders: number };
}

export type PaymentEnvironment = "mock" | "sandbox" | "production";
export interface WalletTopup {
  id: string;
  amount: number;
  environment: PaymentEnvironment;
  status: string;
  createdAt: string;
  simulationAllowed: boolean;
}
export interface WalletEntry {
  id: string;
  kind: "topup_credit" | "order_debit" | "order_refund" | "topup_reversal";
  amount: number;
  balanceAfter: number;
  createdAt: string;
  orderId?: string;
  topupId?: string;
}
export interface Wallet {
  environment: PaymentEnvironment;
  currency: "KZT";
  balance: number;
  frozen: boolean;
  entries: WalletEntry[];
  topups: WalletTopup[];
  topupAvailable: boolean;
}

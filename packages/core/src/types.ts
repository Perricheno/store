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
  names: Translations;
  description: Translations;
  details: ProductDetail[];
  promotion?: ProductPromotion;
  price: number;
  oldPrice?: number;
  media: string[];
  sizes: Array<{ id: string; size: string; color: string; available: number }>;
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

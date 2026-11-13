import { type Locale } from "../lib/i18n";
import type { Product } from "@urbanmag/core";

export type ShopSettings = {
  address?: string;
  pickupAddress?: string;
  pickupCity?: string;
  pickupHours?: string;
  kazpostEnabled?: boolean;
  phone?: string;
  email?: string;
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
};

export type Common = {
  locale: Locale;
  settings?: ShopSettings;
  initialCart?: Cart;
};

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

export type Order = {
  id: string;
  number?: string;
  status: string;
  total: number;
  paymentStatus: string;
  paymentMethod?: "apipay" | "wallet";
  isDemo?: boolean;
  simulationAllowed?: boolean;
  createdAt?: string;
  paymentUrl?: string;
  invoiceUrl?: string;
};

export type CatalogPagination = {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export type CatalogPage = CatalogPagination & { products: Product[] };

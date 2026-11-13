import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: text("role").notNull(),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const products = pgTable("products", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  category: text("category").notNull(),
  gender: text("gender").notNull(),
  brand: text("brand").notNull(),
  names: jsonb("names").notNull(),
  description: jsonb("description").notNull(),
  details: jsonb("details").notNull().default([]),
  promotion: jsonb("promotion"),
  price: integer("price").notNull(),
  oldPrice: integer("old_price"),
  media: jsonb("media").notNull(),
  kaspiUrl: text("kaspi_url"),
  isDemo: boolean("is_demo").notNull(),
  published: boolean("published").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const variants = pgTable("variants", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  size: text("size").notNull(),
  color: text("color").notNull(),
});
export const inventory = pgTable(
  "inventory",
  {
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id),
    branchId: text("branch_id").notNull(),
    quantity: integer("quantity").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.variantId, t.branchId] })],
);
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  realm: text("realm").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  userId: text("user_id").references(() => users.id),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  status: text("status").notNull(),
  total: integer("total").notNull(),
  lines: jsonb("lines").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  requestHash: text("request_hash").notNull(),
  accessTokenHash: text("access_token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  invoiceId: text("invoice_id").unique(),
  amount: integer("amount").notNull(),
  environment: text("environment").notNull(),
  status: text("status").notNull(),
  paymentUrl: text("payment_url"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
});
export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull(),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lockedBy: text("locked_by"),
  lastError: text("last_error"),
});
export const reservations = pgTable(
  "reservations",
  {
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id),
    branchId: text("branch_id").notNull(),
    quantity: integer("quantity").notNull(),
    state: text("state").notNull(),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.variantId, t.branchId] })],
);
export const carts = pgTable(
  "carts",
  {
    visitorId: text("visitor_id").notNull(),
    variantId: text("variant_id")
      .notNull()
      .references(() => variants.id),
    quantity: integer("quantity").notNull(),
  },
  (t) => [primaryKey({ columns: [t.visitorId, t.variantId] })],
);
export const favorites = pgTable(
  "favorites",
  {
    visitorId: text("visitor_id").notNull(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
  },
  (t) => [primaryKey({ columns: [t.visitorId, t.productId] })],
);
export const settings = pgTable("settings", {
  id: text("id").primaryKey(),
  value: jsonb("value").notNull(),
});
export const audit = pgTable("audit", {
  id: text("id").primaryKey(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  entityId: text("entity_id"),
  details: jsonb("details").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const passwordTokens = pgTable("password_tokens", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  kind: text("kind").notNull(),
  realm: text("realm").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});
export const paymentEvents = pgTable("payment_events", {
  eventId: text("event_id").primaryKey(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

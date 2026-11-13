import { queryStaffInsights } from "./staff-insights";
import {
  createHash,
  randomBytes,
  randomUUID,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";
import {
  database,
  transaction,
  closeCoreDatabase,
  getDrizzle,
  type DB,
  type Row,
} from "./db";
import { seed } from "./seed";
import {
  CoreError,
  type Product,
  type User,
  type Cart,
  type Order,
  type OrderLine,
  type Settings,
  type Locale,
  type Job,
  type CatalogPage,
} from "./types";
export * from "./types";
export {
  getWallet,
  createWalletTopup,
  getWalletTopup,
  getWalletTopupInvoice,
  recordWalletTopupInvoice,
  processWalletTopupEvent,
  isWalletTopupId,
  simulateWalletTopup,
  listPendingWalletTopupInvoices,
  refundWalletOrder,
} from "./wallet";
import {
  lockCheckoutWallet,
  debitCheckoutWallet,
  requireWalletCustomer,
} from "./wallet";
import type { PaymentEnvironment } from "./types";
export { getDrizzle };
export { CATEGORIES } from "./categories";
const runtime = globalThis as typeof globalThis & {
  __urbanmagCore?: { initialization?: Promise<void>; localKey: Buffer };
};
const coreState = (runtime.__urbanmagCore ??= { localKey: randomBytes(32) });
const localKey = coreState.localKey;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const token = () => randomBytes(32).toString("base64url");
const date = (v: any) => new Date(v).toISOString();
const fail = (status: number, code: string, message: string): never => {
  throw new CoreError(status, code, message);
};
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success)
    throw new CoreError(
      400,
      "VALIDATION",
      r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  return r.data;
}
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(12).max(256);
const visitorSchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const localeSchema = z.enum(["ru", "kk", "en"]);
const translations = z.object({
  ru: z.string().trim().min(1).max(4000),
  kk: z.string().trim().min(1).max(4000),
  en: z.string().trim().min(1).max(4000),
});
const descriptionTranslations = z
  .object({
    ru: z.string().trim().max(4000).default(""),
    kk: z.string().trim().max(4000).default(""),
    en: z.string().trim().max(4000).default(""),
  })
  .default({ ru: "", kk: "", en: "" });
function user(row: Row): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    mustChangePassword: row.must_change_password,
  };
}
function encryptionKey() {
  const value = process.env.MAIL_ENCRYPTION_KEY;
  if (!value) {
    if (process.env.APP_ENV === "production")
      throw new Error("MAIL_ENCRYPTION_KEY required");
    return localKey;
  }
  const key = /^[a-f0-9]{64}$/i.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, "base64");
  if (key.length !== 32)
    throw new Error(
      "MAIL_ENCRYPTION_KEY must encode exactly 32 bytes in hex or base64",
    );
  return key;
}
function encryptMail(value: { to: string; subject: string; text: string }) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return {
    encrypted: Buffer.from(
      JSON.stringify({
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        data: data.toString("base64"),
      }),
    ).toString("base64"),
  };
}
export function decryptMailPayload(payload: Record<string, unknown>): {
  to: string;
  subject: string;
  text: string;
} {
  const envelope = JSON.parse(
    Buffer.from(String(payload.encrypted), "base64").toString(),
  );
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(envelope.data, "base64")),
      decipher.final(),
    ]).toString(),
  );
}
async function enqueue(db: DB, type: string, payload: unknown) {
  await db.query(
    "INSERT INTO jobs(id,type,payload,status) VALUES($1,$2,$3::jsonb,'pending')",
    [randomUUID(), type, JSON.stringify(payload)],
  );
}
async function audit(
  db: DB,
  actorId: string | null,
  action: string,
  entityId: string | null,
  details: unknown = {},
) {
  await db.query(
    "INSERT INTO audit(id,actor_id,action,entity_id,details) VALUES($1,$2,$3,$4,$5::jsonb)",
    [randomUUID(), actorId, action, entityId, JSON.stringify(details)],
  );
}
export async function initCore() {
  return (coreState.initialization ??= initialize().catch((error) => {
    coreState.initialization = undefined;
    throw error;
  }));
}
async function initialize() {
  const db = await database();
  encryptionKey();
  await transaction(async (tx) => {
    await tx.query(
      "INSERT INTO settings(id,value) VALUES($1,$2::jsonb) ON CONFLICT DO NOTHING",
      [
        "store",
        JSON.stringify({
          pickupCity: "Жезказган",
          pickupAddress: "Адрес самовывоза уточняется",
          pickupHours: "График уточняется",
          kazpostEnabled: false,
        }),
      ],
    );
    await seed(tx);
  });
  const email = process.env.BOOTSTRAP_OWNER_EMAIL,
    password = process.env.BOOTSTRAP_OWNER_PASSWORD;
  if (Boolean(email) !== Boolean(password))
    throw new Error(
      "Set both BOOTSTRAP_OWNER_EMAIL and BOOTSTRAP_OWNER_PASSWORD",
    );
  if (email && password) {
    const safeEmail = parse(emailSchema, email);
    parse(passwordSchema, password);
    const exists = await db.query(
      "SELECT id FROM users WHERE role='owner' LIMIT 1",
    );
    if (!exists.length) {
      const passwordHash = await hash(password);
      await db.query(
        "INSERT INTO users(id,email,password_hash,role,must_change_password) VALUES($1,$2,$3,'owner',true) ON CONFLICT DO NOTHING",
        [randomUUID(), safeEmail, passwordHash],
      );
    }
  }
}
export async function closeCore() {
  await closeCoreDatabase();
  coreState.initialization = undefined;
}
async function staff(db: DB, actorId: string, owner = false) {
  const rows = await db.query("SELECT * FROM users WHERE id=$1", [actorId]);
  const actor = rows[0];
  if (
    !actor ||
    !["owner", "manager"].includes(actor.role) ||
    (owner && actor.role !== "owner")
  )
    fail(403, "FORBIDDEN", "Доступ запрещён");
  if (actor.must_change_password)
    fail(403, "PASSWORD_CHANGE_REQUIRED", "Сначала измените временный пароль");
  return actor;
}
async function lockVisitor(db: DB, id: string) {
  parse(visitorSchema, id);
  await db.query(
    "INSERT INTO visitor_locks(visitor_id) VALUES($1) ON CONFLICT DO NOTHING",
    [id],
  );
  await db.query(
    "SELECT visitor_id FROM visitor_locks WHERE visitor_id=$1 FOR UPDATE",
    [id],
  );
}
async function hydrateProducts(db: DB, rows: Row[]): Promise<Product[]> {
  if (!rows.length) return [];
  const variants = await db.query(
    "SELECT v.*,COALESCE(SUM(i.quantity-i.reserved),0)::integer AS available FROM variants v LEFT JOIN inventory i ON i.variant_id=v.id WHERE v.product_id=ANY($1::text[]) GROUP BY v.id,v.product_id,v.size,v.color ORDER BY v.id",
    [rows.map((row) => row.id)],
  );
  const byProduct = new Map<string, Product["sizes"]>();
  for (const variant of variants) {
    const sizes = byProduct.get(variant.product_id) ?? [];
    sizes.push({
      id: variant.id,
      size: variant.size,
      color: variant.color,
      available: variant.available,
    });
    byProduct.set(variant.product_id, sizes);
  }
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    category: r.category,
    gender: r.gender,
    brand: r.brand,
    names: r.names,
    description: r.description,
    details: r.details ?? [],
    ...(r.promotion ? { promotion: r.promotion } : {}),
    price: r.price,
    ...(r.old_price != null ? { oldPrice: r.old_price } : {}),
    media: r.media,
    sizes: byProduct.get(r.id) ?? [],
    ...(r.kaspi_url ? { kaspiUrl: r.kaspi_url } : {}),
    isDemo: r.is_demo,
    published: r.published,
    createdAt: date(r.created_at),
  }));
}
async function productRows(
  db: DB,
  includeUnpublished = false,
): Promise<Product[]> {
  return hydrateProducts(
    db,
    await db.query(
      `SELECT * FROM products ${includeUnpublished ? "" : "WHERE published=true"} ORDER BY created_at DESC,id`,
    ),
  );
}
export interface ProductFilters {
  includeUnpublished?: boolean;
  q?: string;
  category?: string;
  size?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  available?: boolean;
  sort?: string;
  gender?: string;
}
const filterSchema = z.object({
  includeUnpublished: z.boolean().optional(),
  q: z.string().trim().max(200).optional(),
  category: z.string().max(80).optional(),
  size: z.string().max(32).optional(),
  minPrice: z.number().min(0).max(100000000).optional(),
  maxPrice: z.number().min(0).max(100000000).optional(),
  inStock: z.boolean().optional(),
  available: z.boolean().optional(),
  sort: z.string().max(32).optional(),
  gender: z.enum(["men", "women", "unisex"]).optional(),
});
function catalogQuery(input: ProductFilters) {
  const filters = parse(filterSchema, input),
    params: unknown[] = [],
    clauses: string[] = [];
  const bind = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  if (!filters.includeUnpublished) clauses.push("p.published=true");
  if (filters.q) {
    const pattern = bind(`%${filters.q.replace(/[\\%_]/g, "\\$&")}%`);
    clauses.push(
      `(${["p.names->>'ru'", "p.names->>'kk'", "p.names->>'en'", "p.description->>'ru'", "p.description->>'kk'", "p.description->>'en'", "p.brand"].map((column) => `(${column}) ILIKE ${pattern}`).join(" OR ")})`,
    );
  }
  if (filters.category) clauses.push(`p.category=${bind(filters.category)}`);
  if (filters.gender)
    clauses.push(`(p.gender=${bind(filters.gender)} OR p.gender='unisex')`);
  if (filters.minPrice != null)
    clauses.push(`p.price>=${bind(filters.minPrice)}`);
  if (filters.maxPrice != null)
    clauses.push(`p.price<=${bind(filters.maxPrice)}`);
  if (filters.size || filters.inStock || filters.available) {
    const size = filters.size ? ` AND v.size=${bind(filters.size)}` : "";
    clauses.push(
      `EXISTS(SELECT 1 FROM variants v JOIN inventory i ON i.variant_id=v.id WHERE v.product_id=p.id AND i.quantity>i.reserved${size})`,
    );
  }
  const order =
    filters.sort === "price-asc"
      ? "p.price ASC,p.created_at DESC,p.id ASC"
      : filters.sort === "price-desc"
        ? "p.price DESC,p.created_at DESC,p.id ASC"
        : "p.created_at DESC,p.id ASC";
  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
    order,
  };
}
export async function getProducts(
  filters: ProductFilters = {},
): Promise<Product[]> {
  await initCore();
  const db = await database(),
    query = catalogQuery(filters);
  return hydrateProducts(
    db,
    await db.query(
      `SELECT p.* FROM products p ${query.where} ORDER BY ${query.order}`,
      query.params,
    ),
  );
}
export async function getCatalogPage(
  filters: ProductFilters & { page?: number; pageSize?: number } = {},
): Promise<CatalogPage> {
  await initCore();
  const { page, pageSize } = parse(
      z.object({
        page: z.number().int().min(1).max(1000000).default(1),
        pageSize: z.number().int().min(1).max(60).default(24),
      }),
      filters,
    ),
    query = catalogQuery(filters),
    db = await database();
  const [count] = await db.query(
    `SELECT COUNT(*)::integer AS total FROM products p ${query.where}`,
    query.params,
  );
  const rows = await db.query(
    `SELECT p.* FROM products p ${query.where} ORDER BY ${query.order} LIMIT $${query.params.length + 1} OFFSET $${query.params.length + 2}`,
    [...query.params, pageSize, (page - 1) * pageSize],
  );
  return {
    products: await hydrateProducts(db, rows),
    total: count!.total,
    page,
    pageSize,
    hasMore: page * pageSize < count!.total,
  };
}
export async function getProduct(slug: string): Promise<Product | null> {
  await initCore();
  const db = await database();
  return (
    (
      await hydrateProducts(
        db,
        await db.query(
          "SELECT * FROM products WHERE slug=$1 AND published=true",
          [slug],
        ),
      )
    )[0] ?? null
  );
}
async function cart(db: DB, visitorId: string): Promise<Cart> {
  const rows = await db.query(
    "SELECT c.*,v.product_id,v.size,v.color FROM carts c JOIN variants v ON v.id=c.variant_id WHERE c.visitor_id=$1 ORDER BY c.variant_id",
    [visitorId],
  );
  const products = await hydrateProducts(
    db,
    rows.length
      ? await db.query(
          "SELECT * FROM products WHERE published=true AND id=ANY($1::text[])",
          [rows.map((row) => row.product_id)],
        )
      : [],
  );
  const items = rows.flatMap((r) => {
    const product = products.find((p) => p.id === r.product_id);
    if (!product) return [];
    return [
      {
        variantId: r.variant_id,
        quantity: r.quantity,
        product,
        size: r.size,
        color: r.color,
        available:
          product.sizes.find((v) => v.id === r.variant_id)?.available ?? 0,
        lineTotal: product.price * r.quantity,
      },
    ];
  });
  return {
    items,
    total: items.reduce((a, i) => a + i.lineTotal, 0),
    count: items.reduce((a, i) => a + i.quantity, 0),
  };
}
export async function getCart(visitorId: string): Promise<Cart> {
  await initCore();
  parse(visitorSchema, visitorId);
  return cart(await database(), visitorId);
}
export async function updateCart(
  visitorId: string,
  variantId: string,
  quantity: number,
): Promise<Cart> {
  await initCore();
  parse(z.number().int().min(0).max(50), quantity);
  return transaction(async (db) => {
    await lockVisitor(db, visitorId);
    if (quantity === 0)
      await db.query(
        "DELETE FROM carts WHERE visitor_id=$1 AND variant_id=$2",
        [visitorId, variantId],
      );
    else {
      const variants = await db.query(
        "SELECT v.id,COALESCE(SUM(i.quantity-i.reserved),0)::integer AS available FROM variants v JOIN products p ON p.id=v.product_id LEFT JOIN inventory i ON i.variant_id=v.id WHERE v.id=$1 AND p.published=true GROUP BY v.id",
        [variantId],
      );
      if (!variants[0]) fail(404, "NOT_FOUND", "Товар не найден");
      if (variants[0].available < quantity)
        fail(409, "OUT_OF_STOCK", "Недостаточно товара");
      await db.query(
        "INSERT INTO carts(visitor_id,variant_id,quantity) VALUES($1,$2,$3) ON CONFLICT(visitor_id,variant_id) DO UPDATE SET quantity=EXCLUDED.quantity",
        [visitorId, variantId, quantity],
      );
    }
    return cart(db, visitorId);
  });
}
export async function toggleFavorite(visitorId: string, productId: string) {
  await initCore();
  return transaction(async (db) => {
    await lockVisitor(db, visitorId);
    const existing = await db.query(
      "DELETE FROM favorites WHERE visitor_id=$1 AND product_id=$2 RETURNING product_id",
      [visitorId, productId],
    );
    if (existing.length) return false;
    const product = await db.query(
      "SELECT id FROM products WHERE id=$1 AND published=true",
      [productId],
    );
    if (!product.length) fail(404, "NOT_FOUND", "Товар не найден");
    await db.query(
      "INSERT INTO favorites(visitor_id,product_id) VALUES($1,$2)",
      [visitorId, productId],
    );
    return true;
  });
}
export async function getFavorites(visitorId: string): Promise<Product[]> {
  await initCore();
  parse(visitorSchema, visitorId);
  const db = await database();
  const rows = await db.query(
    "SELECT product_id FROM favorites WHERE visitor_id=$1",
    [visitorId],
  );
  const ids = new Set(rows.map((r) => r.product_id));
  return (await productRows(db)).filter((p) => ids.has(p.id));
}
export async function createSession(
  email: string,
  password: string,
  realm: "buyer" | "staff",
): Promise<{ token: string; user: User }> {
  await initCore();
  parse(z.enum(["buyer", "staff"]), realm);
  const safeEmail = parse(emailSchema, email);
  const db = await database();
  const rows = await db.query("SELECT * FROM users WHERE email=$1", [
    safeEmail,
  ]);
  const row = rows[0];
  let valid = false;
  if (row?.password_hash)
    try {
      valid = await verify(row.password_hash, password);
    } catch {}
  else await hash("timing-equalization-password");
  if (
    !valid ||
    !row ||
    (realm === "staff" && !["manager", "owner"].includes(row.role)) ||
    (realm === "buyer" && row.role !== "customer")
  )
    fail(401, "INVALID_CREDENTIALS", "Неверный email или пароль");
  if (
    row.temporary_password_expires_at &&
    new Date(row.temporary_password_expires_at) < new Date()
  )
    fail(401, "PASSWORD_EXPIRED", "Временный пароль истёк");
  const value = token();
  return transaction(async (tx) => {
    const [current] = await tx.query(
      "SELECT * FROM users WHERE id=$1 FOR UPDATE",
      [row.id],
    );
    // A reset that won after verification must prevent a login with the old password.
    if (!current || current.password_hash !== row.password_hash)
      fail(401, "INVALID_CREDENTIALS", "Неверный email или пароль");
    await tx.query(
      "INSERT INTO sessions(token_hash,user_id,realm,expires_at) VALUES($1,$2,$3,$4)",
      [
        sha(value),
        row.id,
        realm,
        new Date(Date.now() + (realm === "staff" ? 8 : 24 * 30) * 3600000),
      ],
    );
    return { token: value, user: user(current) };
  });
}
export async function getSession(
  value: string,
  realm: "buyer" | "staff",
): Promise<User | null> {
  await initCore();
  if (!value) return null;
  const rows = await (
    await database()
  ).query(
    "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.realm=$2 AND s.expires_at>now() AND (u.temporary_password_expires_at IS NULL OR u.temporary_password_expires_at>now())",
    [sha(value), realm],
  );
  return rows[0] ? user(rows[0]) : null;
}
export async function destroySession(value: string) {
  await initCore();
  await (
    await database()
  ).query("DELETE FROM sessions WHERE token_hash=$1", [sha(value)]);
}
export async function changePassword(
  value: string,
  realm: "buyer" | "staff",
  currentPassword: string,
  newPassword: string,
) {
  await initCore();
  parse(passwordSchema, newPassword);
  const session = await getSession(value, realm);
  if (!session) throw new CoreError(401, "UNAUTHORIZED", "Требуется вход");
  parse(z.string().min(1).max(256), currentPassword);
  const passwordHash = await hash(newPassword);
  await transaction(async (tx) => {
    const [row] = await tx.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [
      session.id,
    ]);
    const [active] = await tx.query(
      "SELECT token_hash FROM sessions WHERE token_hash=$1 AND realm=$2 AND expires_at>now()",
      [sha(value), realm],
    );
    if (!active) fail(401, "UNAUTHORIZED", "Требуется вход");
    if (
      !row.password_hash ||
      !(await verify(row.password_hash, currentPassword))
    )
      fail(401, "INVALID_CREDENTIALS", "Неверный текущий пароль");
    await tx.query(
      "UPDATE users SET password_hash=$1,must_change_password=false,temporary_password_expires_at=NULL WHERE id=$2",
      [passwordHash, row.id],
    );
    await tx.query("DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2", [
      row.id,
      sha(value),
    ]);
    await tx.query(
      "UPDATE password_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL",
      [row.id],
    );
    await audit(tx, row.id, "password.changed", row.id);
  });
}
export async function requestPasswordReset(
  email: string,
  realm: "buyer" | "staff" = "buyer",
) {
  await initCore();
  const safeEmail = parse(emailSchema, email);
  parse(z.enum(["buyer", "staff"]), realm);
  await transaction(async (db) => {
    const [row] = await db.query(
      "SELECT * FROM users WHERE email=$1 FOR UPDATE",
      [safeEmail],
    );
    if (
      !row ||
      (realm === "buyer" && row.role !== "customer") ||
      (realm === "staff" && row.role === "customer")
    )
      return;
    const value = token();
    await db.query(
      "UPDATE password_tokens SET used_at=now() WHERE user_id=$1 AND kind='reset' AND used_at IS NULL",
      [row.id],
    );
    await db.query(
      "INSERT INTO password_tokens(token_hash,user_id,kind,realm,expires_at) VALUES($1,$2,'reset',$3,$4)",
      [sha(value), row.id, realm, new Date(Date.now() + 3600000)],
    );
    const base = (
      (realm === "staff" ? process.env.STAFF_URL : process.env.APP_URL) ||
      "http://localhost:3000"
    ).replace(/\/+$/, "");
    const url = `${base}/${realm === "staff" ? "staff/" : ""}reset-password?token=${encodeURIComponent(value)}`;
    await enqueue(
      db,
      "send_mail",
      encryptMail({
        to: safeEmail,
        subject: "URBANMAG — смена пароля",
        text: `Ссылка для смены пароля действует один час: ${url}`,
      }),
    );
  });
  return { ok: true };
}
async function redeemPasswordToken(
  value: string,
  newPassword: string,
  kind: "claim" | "reset",
  realm: "buyer" | "staff",
) {
  await initCore();
  parse(passwordSchema, newPassword);
  const passwordHash = await hash(newPassword);
  await transaction(async (db) => {
    const [candidate] = await db.query(
      "SELECT user_id FROM password_tokens WHERE token_hash=$1",
      [sha(value)],
    );
    if (!candidate)
      fail(400, "INVALID_TOKEN", "Ссылка недействительна или устарела");
    // All password mutations lock the user before token rows, avoiding lock-order inversions.
    await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [
      candidate.user_id,
    ]);
    const [row] = await db.query(
      "SELECT * FROM password_tokens WHERE token_hash=$1 AND kind=$2 AND realm=$3 AND used_at IS NULL AND expires_at>now() FOR UPDATE",
      [sha(value), kind, realm],
    );
    if (!row) fail(400, "INVALID_TOKEN", "Ссылка недействительна или устарела");
    await db.query(
      "UPDATE users SET password_hash=$1,must_change_password=false,temporary_password_expires_at=NULL WHERE id=$2",
      [passwordHash, row.user_id],
    );
    await db.query(
      "UPDATE password_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL",
      [row.user_id],
    );
    await db.query("DELETE FROM sessions WHERE user_id=$1", [row.user_id]);
    await audit(db, row.user_id, `password.${kind}`, row.user_id);
  });
  return { ok: true };
}
export async function resetPassword(
  value: string,
  newPassword: string,
  realm: "buyer" | "staff" = "buyer",
) {
  return redeemPasswordToken(value, newPassword, "reset", realm);
}
export async function claimAccount(value: string, newPassword: string) {
  return redeemPasswordToken(value, newPassword, "claim", "buyer");
}
const checkoutSchema = z.object({
  paymentMethod: z.enum(["apipay", "wallet"]).default("apipay"),
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{10,24}$/),
  fulfillment: z.literal("pickup"),
  expectedTotal: z.number().int().min(1).max(100000000),
  idempotencyKey: z
    .string()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
  locale: localeSchema,
});
export interface CheckoutInput {
  paymentMethod?: "apipay" | "wallet";
  email: string;
  phone: string;
  fulfillment: string;
  expectedTotal: number;
  idempotencyKey: string;
  locale: Locale;
}
async function orderView(db: DB, row: Row): Promise<Order> {
  const [payment] = await db.query("SELECT * FROM payments WHERE order_id=$1", [
    row.id,
  ]);
  return {
    id: row.id,
    status: row.status,
    total: row.total,
    lines: row.lines,
    email: row.email,
    phone: row.phone,
    fulfillment: "pickup",
    locale: row.locale,
    createdAt: date(row.created_at),
    expiresAt: date(row.expires_at),
    ...(payment?.payment_url ? { paymentUrl: payment.payment_url } : {}),
    ...(payment
      ? {
          paymentStatus: payment.status,
          paymentMethod: payment.method || "apipay",
        }
      : {}),
  };
}
function payEnvironment() {
  const mode = process.env.APIPAY_MODE || "mock";
  if (!["mock", "sandbox", "production"].includes(mode))
    throw new Error("Invalid APIPAY_MODE");
  if (mode === "mock" && process.env.APP_ENV === "production")
    fail(
      503,
      "PAYMENTS_UNAVAILABLE",
      "Mock payments are disabled in production",
    );
  return mode;
}
export async function createCheckout(
  visitorId: string,
  input: CheckoutInput,
  sessionUserId?: string,
): Promise<{ order: Order; accessToken?: string }> {
  await initCore();
  const data = parse(checkoutSchema, input);
  const environment = payEnvironment();
  const { paymentMethod: selectedMethod, ...legacyData } = data;
  const requestHash = sha(
    JSON.stringify(selectedMethod === "apipay" ? legacyData : data),
  );
  return transaction(async (db) => {
    await lockVisitor(db, visitorId);
    const [existing] = await db.query(
      "SELECT * FROM orders WHERE visitor_id=$1 AND idempotency_key=$2 FOR UPDATE",
      [visitorId, data.idempotencyKey],
    );
    const current = await cart(db, visitorId);
    if (existing) {
      const [originalPayment] = await db.query(
        "SELECT method,environment FROM payments WHERE order_id=$1",
        [existing.id],
      );
      if (
        (originalPayment?.method || "apipay") !== data.paymentMethod ||
        (data.paymentMethod === "wallet" &&
          (!sessionUserId ||
            existing.user_id !== sessionUserId ||
            originalPayment.environment !== environment))
      )
        fail(409, "CHECKOUT_CHANGED", "Параметры заказа изменились");
      if (data.paymentMethod === "wallet")
        await requireWalletCustomer(db, sessionUserId!);
      if (existing.request_hash !== requestHash)
        fail(409, "CHECKOUT_CHANGED", "Параметры заказа изменились");
      if (current.items.length) {
        const stored = existing.lines
          .map((l: OrderLine) => ({
            variantId: l.variantId,
            quantity: l.quantity,
          }))
          .sort((a: any, b: any) => a.variantId.localeCompare(b.variantId));
        const now = current.items
          .map((l) => ({ variantId: l.variantId, quantity: l.quantity }))
          .sort((a, b) => a.variantId.localeCompare(b.variantId));
        if (
          JSON.stringify(stored) !== JSON.stringify(now) ||
          current.total !== existing.total
        )
          fail(409, "CHECKOUT_CHANGED", "Корзина изменилась");
      }
      return { order: await orderView(db, existing) };
    }
    if (data.paymentMethod === "wallet" && !sessionUserId)
      fail(401, "UNAUTHORIZED", "Войдите в кабинет");
    const wallet =
      data.paymentMethod === "wallet"
        ? await lockCheckoutWallet(
            db,
            sessionUserId!,
            environment as PaymentEnvironment,
          )
        : undefined;
    if (!current.items.length) fail(409, "EMPTY_CART", "Корзина пуста");
    if (current.total !== data.expectedTotal)
      fail(409, "TOTAL_CHANGED", "Цена заказа изменилась");
    if (
      environment === "production" &&
      current.items.some((i) => i.product.isDemo)
    )
      fail(
        409,
        "DEMO_PAYMENT_BLOCKED",
        "Демонстрационные товары нельзя оплачивать в реальном режиме",
      );
    if (
      data.paymentMethod === "apipay" &&
      environment === "production" &&
      ["APIPAY_API_KEY", "APIPAY_WEBHOOK_SECRET", "SMTP_URL", "MAIL_FROM"].some(
        (key) => !process.env[key],
      )
    )
      fail(
        503,
        "PAYMENTS_UNAVAILABLE",
        "Оплата временно недоступна. Обратитесь в магазин",
      );
    // Freeze catalog records while taking price snapshots, then lock inventory in stable order.
    const ids = current.items.map((i) => i.product.id).sort();
    await db.query(
      "SELECT id FROM products WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE",
      [ids],
    );
    const fresh = await cart(db, visitorId);
    if (
      fresh.total !== data.expectedTotal ||
      fresh.items.length !== current.items.length
    )
      fail(409, "TOTAL_CHANGED", "Цена заказа изменилась");
    if (
      environment === "production" &&
      fresh.items.some((i) => i.product.isDemo)
    )
      fail(
        409,
        "DEMO_PAYMENT_BLOCKED",
        "Демонстрационные товары нельзя оплачивать в реальном режиме",
      );
    const orderId = randomUUID(),
      accessToken = token();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const lines: OrderLine[] = fresh.items.map((i) => ({
      productId: i.product.id,
      category: i.product.category,
      variantId: i.variantId,
      name: i.product.names[data.locale],
      names: i.product.names,
      size: i.size,
      color: i.color,
      price: i.product.price,
      quantity: i.quantity,
      media: i.product.media,
      isDemo: i.product.isDemo,
    }));
    let attachedUserId: string | null = null;
    if (sessionUserId) {
      const [account] = await db.query(
        "SELECT * FROM users WHERE id=$1 AND role='customer'",
        [sessionUserId],
      );
      if (!account) fail(401, "UNAUTHORIZED", "Требуется вход");
      if (account.must_change_password)
        fail(403, "PASSWORD_CHANGE_REQUIRED", "Измените временный пароль");
      if (account.email !== data.email)
        fail(
          400,
          "EMAIL_MISMATCH",
          "Email заказа должен совпадать с email аккаунта",
        );
      attachedUserId = account.id;
    }
    // A checkout never attaches to an existing account just because its email was entered.
    const [known] = await db.query("SELECT id FROM users WHERE email=$1", [
      data.email,
    ]);
    if (!known && !sessionUserId) {
      const temporaryPassword = `U!${token()}`;
      const newId = randomUUID();
      const result = await db.query(
        "INSERT INTO users(id,email,password_hash,role,must_change_password,temporary_password_expires_at) VALUES($1,$2,$3,'customer',true,$4) ON CONFLICT(email) DO NOTHING RETURNING id",
        [
          newId,
          data.email,
          await hash(temporaryPassword),
          new Date(Date.now() + 86400000),
        ],
      );
      if (result.length) {
        attachedUserId = newId;
        const claim = token();
        await db.query(
          "INSERT INTO password_tokens(token_hash,user_id,kind,realm,expires_at) VALUES($1,$2,'claim','buyer',$3)",
          [sha(claim), newId, new Date(Date.now() + 86400000)],
        );
        const link = `${process.env.APP_URL || "http://localhost:3000"}/claim-account?token=${encodeURIComponent(claim)}`;
        await enqueue(
          db,
          "send_mail",
          encryptMail({
            to: data.email,
            subject: {
              ru: "URBANMAG — ваш аккаунт",
              kk: "URBANMAG — жеке кабинетіңіз",
              en: "URBANMAG — your account",
            }[data.locale],
            text: {
              ru: `Email: ${data.email}\nВаш временный пароль: ${temporaryPassword}\nОн действует 24 часа и требует смены при первом входе.\nУстановить свой пароль: ${link}`,
              kk: `Email: ${data.email}\nУақытша құпиясөзіңіз: ${temporaryPassword}\nОл 24 сағат жарамды. Алғаш кіргенде құпиясөзді өзгертіңіз.\nЖаңа құпиясөз орнату: ${link}`,
              en: `Email: ${data.email}\nYour temporary password: ${temporaryPassword}\nIt expires in 24 hours and must be changed when you first sign in.\nSet your password: ${link}`,
            }[data.locale],
          }),
        );
      }
    }
    await db.query(
      "INSERT INTO orders(id,visitor_id,user_id,email,phone,fulfillment,locale,status,total,lines,idempotency_key,request_hash,access_token_hash,expires_at) VALUES($1,$2,$3,$4,$5,'pickup',$6,'awaiting_payment',$7,$8::jsonb,$9,$10,$11,$12)",
      [
        orderId,
        visitorId,
        attachedUserId,
        data.email,
        data.phone,
        data.locale,
        fresh.total,
        JSON.stringify(lines),
        data.idempotencyKey,
        requestHash,
        sha(accessToken),
        expiresAt,
      ],
    );
    for (const item of [...fresh.items].sort((a, b) =>
      a.variantId.localeCompare(b.variantId),
    )) {
      const inventory = await db.query(
        "SELECT * FROM inventory WHERE variant_id=$1 ORDER BY branch_id FOR UPDATE",
        [item.variantId],
      );
      let needed = item.quantity;
      for (const stock of inventory) {
        const qty = Math.min(needed, stock.quantity - stock.reserved);
        if (qty > 0) {
          await db.query(
            "UPDATE inventory SET reserved=reserved+$1 WHERE variant_id=$2 AND branch_id=$3",
            [qty, item.variantId, stock.branch_id],
          );
          await db.query(
            "INSERT INTO reservations(order_id,variant_id,branch_id,quantity,state) VALUES($1,$2,$3,$4,'reserved')",
            [orderId, item.variantId, stock.branch_id, qty],
          );
          needed -= qty;
        }
        if (!needed) break;
      }
      if (needed)
        fail(
          409,
          "OUT_OF_STOCK",
          `Недостаточно товара: ${item.product.names[data.locale]}`,
        );
    }
    await db.query(
      "INSERT INTO payments(id,order_id,amount,environment,status,method) VALUES($1,$2,$3,$4,$5,$6)",
      [
        randomUUID(),
        orderId,
        fresh.total,
        environment,
        wallet ? "paid" : "pending",
        data.paymentMethod,
      ],
    );
    if (wallet) {
      await debitCheckoutWallet(db, wallet, orderId, fresh.total);
      await releaseStock(db, orderId, true);
      await db.query("UPDATE orders SET status='paid' WHERE id=$1", [orderId]);
    } else await enqueue(db, "create_invoice", { orderId });
    await db.query("DELETE FROM carts WHERE visitor_id=$1", [visitorId]);
    await audit(db, attachedUserId, "order.created", orderId, {
      total: fresh.total,
      environment,
    });
    const [row] = await db.query("SELECT * FROM orders WHERE id=$1", [orderId]);
    return { order: await orderView(db, row), accessToken };
  });
}
export async function getOrder(
  orderId: string,
  auth: { visitorId?: string; userId?: string; accessToken?: string },
): Promise<Order | null> {
  await initCore();
  const db = await database();
  const [row] = await db.query("SELECT * FROM orders WHERE id=$1", [orderId]);
  if (!row) return null;
  const allowed =
    (auth.visitorId && row.visitor_id === auth.visitorId) ||
    (auth.userId && row.user_id === auth.userId) ||
    (auth.accessToken && row.access_token_hash === sha(auth.accessToken));
  if (!allowed) return null;
  return orderView(db, row);
}
export async function getUserOrders(userId: string): Promise<Order[]> {
  await initCore();
  const db = await database();
  const [account] = await db.query("SELECT * FROM users WHERE id=$1", [userId]);
  if (!account || account.must_change_password)
    fail(403, "PASSWORD_CHANGE_REQUIRED", "Измените пароль");
  const rows = await db.query(
    "SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC",
    [userId],
  );
  return Promise.all(rows.map((r) => orderView(db, r)));
}
export async function getSettings(): Promise<Settings> {
  await initCore();
  const [row] = await (
    await database()
  ).query("SELECT value FROM settings WHERE id='store'");
  return { ...row.value, kazpostEnabled: false };
}
const promotionTranslations = z
  .object({
    ru: z.string().trim().max(300),
    kk: z.string().trim().max(300),
    en: z.string().trim().max(300),
  })
  .strict();
// Root-relative links only. Reject encoded separators and controls as well as
// their literal forms so browser URL normalization cannot change the origin.
const promotionHref = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    if (!value) return true;
    if (!value.startsWith("/") || value.startsWith("//")) return false;
    return (
      !/[\\\x00-\x20\x7f]/.test(value) &&
      !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|20|7f|25)/i.test(value)
    );
  }, "Use an internal path")
  .optional();
const announcementInput = z
  .object({
    enabled: z.boolean(),
    text: promotionTranslations,
    href: promotionHref,
  })
  .strict()
  .refine(
    (value) => !value.enabled || Object.values(value.text).every(Boolean),
  );
const bannerInput = z
  .object({
    enabled: z.boolean(),
    title: promotionTranslations,
    href: promotionHref,
    imageUrl: z
      .string()
      .regex(/^\/api\/media\/[a-f0-9]{64}\.webp$/)
      .optional(),
  })
  .strict()
  .refine(
    (value) => !value.enabled || Object.values(value.title).every(Boolean),
  );
const contentPageTranslations = z
  .object({
    ru: z.string().trim().max(20000),
    kk: z.string().trim().max(20000),
    en: z.string().trim().max(20000),
  })
  .strict();
const contentPagesInput = z
  .object({
    about: contentPageTranslations.optional(),
    delivery: contentPageTranslations.optional(),
    returns: contentPageTranslations.optional(),
    privacy: contentPageTranslations.optional(),
    terms: contentPageTranslations.optional(),
  })
  .strict();
export async function updateSettings(
  actorId: string,
  input: Settings,
): Promise<Settings> {
  await initCore();
  const value = parse(
    z.object({
      contentPages: contentPagesInput.optional(),
      announcement: announcementInput.optional(),
      banner: bannerInput.optional(),
      pickupCity: z.string().trim().min(1).max(200),
      pickupAddress: z.string().trim().min(1).max(500),
      pickupHours: z.string().trim().min(1).max(300),
      kazpostEnabled: z.literal(false).default(false),
    }),
    input,
  );
  return transaction(async (db) => {
    await staff(db, actorId, true);
    await db.query("UPDATE settings SET value=$1::jsonb WHERE id='store'", [
      JSON.stringify(value),
    ]);
    await audit(db, actorId, "settings.updated", "store", value);
    return value;
  });
}
const productInput = z.object({
  id: z.string().min(1).max(128).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120),
  category: z.string().trim().min(1).max(80),
  gender: z.enum(["men", "women", "unisex"]),
  brand: z.string().trim().min(1).max(100),
  names: translations,
  description: descriptionTranslations,
  details: z
    .array(
      z.object({
        key: z
          .string()
          .trim()
          .min(1)
          .max(64)
          .regex(/^[a-z][a-z0-9_-]*$/),
        label: z.object({
          ru: z.string().trim().min(1).max(100),
          kk: z.string().trim().min(1).max(100),
          en: z.string().trim().min(1).max(100),
        }),
        value: z.object({
          ru: z.string().trim().min(1).max(500),
          kk: z.string().trim().min(1).max(500),
          en: z.string().trim().min(1).max(500),
        }),
        enabled: z.boolean(),
      }),
    )
    .max(12)
    .refine(
      (details) =>
        new Set(details.map((detail) => detail.key)).size === details.length,
      "Detail keys must be unique",
    )
    .optional(),
  promotion: z
    .object({
      enabled: z.boolean(),
      label: z.object({
        ru: z.string().trim().max(80),
        kk: z.string().trim().max(80),
        en: z.string().trim().max(80),
      }),
      percent: z.number().int().min(1).max(99).optional(),
    })
    .refine(
      (promotion) =>
        !promotion.enabled || Object.values(promotion.label).every(Boolean),
      "Enabled promotion requires all translations",
    )
    .nullable()
    .optional(),
  price: z.number().int().min(1).max(100000000),
  oldPrice: z.number().int().min(0).max(100000000).optional(),
  media: z
    .array(
      z
        .string()
        .max(2048)
        .refine(
          (v) => /^https:\/\//.test(v) || /^\/(?!\/)/.test(v),
          "Use HTTPS or local media paths",
        ),
    )
    .max(12),
  kaspiUrl: z
    .string()
    .url()
    .refine((v) => {
      try {
        const u = new URL(v);
        return (
          u.protocol === "https:" &&
          (u.hostname === "kaspi.kz" || u.hostname.endsWith(".kaspi.kz"))
        );
      } catch {
        return false;
      }
    })
    .optional(),
  isDemo: z.boolean(),
  published: z.boolean(),
  sizes: z
    .array(
      z.object({
        id: z.string().min(1).max(128).optional(),
        size: z.string().trim().min(1).max(32),
        color: z.string().trim().min(1).max(80),
      }),
    )
    .min(1)
    .max(100),
});
export async function upsertProduct(
  actorId: string,
  input: unknown,
): Promise<Product> {
  await initCore();
  const value = parse(productInput, input);
  if (
    new Set(value.sizes.map((s) => `${s.size}|${s.color}`)).size !==
    value.sizes.length
  )
    fail(400, "VALIDATION", "Размер и цвет должны быть уникальны");
  return transaction(async (db) => {
    await staff(db, actorId);
    const id = value.id || randomUUID();
    const [existing] = await db.query(
      "SELECT * FROM products WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (existing?.is_demo !== undefined && existing.is_demo !== value.isDemo)
      fail(
        409,
        "DEMO_IMMUTABLE",
        "Признак демонстрационного товара нельзя менять",
      );
    await db.query(
      "INSERT INTO products(id,slug,category,gender,brand,names,description,price,old_price,media,kaspi_url,is_demo,published,details,promotion) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10::jsonb,$11,$12,$13,$14::jsonb,$15::jsonb) ON CONFLICT(id) DO UPDATE SET slug=EXCLUDED.slug,category=EXCLUDED.category,gender=EXCLUDED.gender,brand=EXCLUDED.brand,names=EXCLUDED.names,description=EXCLUDED.description,price=EXCLUDED.price,old_price=EXCLUDED.old_price,media=EXCLUDED.media,kaspi_url=EXCLUDED.kaspi_url,published=EXCLUDED.published,details=EXCLUDED.details,promotion=EXCLUDED.promotion",
      [
        id,
        value.slug,
        value.category,
        value.gender,
        value.brand,
        JSON.stringify(value.names),
        JSON.stringify(value.description),
        value.price,
        value.oldPrice ?? null,
        JSON.stringify(value.media),
        value.kaspiUrl ?? null,
        value.isDemo,
        value.published,
        JSON.stringify(value.details ?? existing?.details ?? []),
        JSON.stringify(
          value.promotion === undefined
            ? (existing?.promotion ?? null)
            : value.promotion,
        ),
      ],
    );
    const retained: string[] = [];
    for (const size of value.sizes) {
      const vid = size.id || randomUUID();
      const [old] = await db.query(
        "SELECT product_id FROM variants WHERE id=$1",
        [vid],
      );
      if (old && old.product_id !== id)
        fail(400, "VALIDATION", "Вариант принадлежит другому товару");
      await db.query(
        "INSERT INTO variants(id,product_id,size,color) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET size=EXCLUDED.size,color=EXCLUDED.color",
        [vid, id, size.size, size.color],
      );
      await db.query(
        "INSERT INTO inventory(variant_id,branch_id,quantity,reserved) VALUES($1,'main',0,0) ON CONFLICT DO NOTHING",
        [vid],
      );
      retained.push(vid);
    }
    // Variants are immutable historical identities; omitting one is rejected instead of destroying order references.
    const removed = await db.query(
      "SELECT id FROM variants WHERE product_id=$1 AND NOT(id=ANY($2::text[]))",
      [id, retained],
    );
    if (removed.length)
      fail(
        409,
        "VARIANT_IN_USE",
        "Существующие варианты нужно сохранить; остаток можно установить в ноль",
      );
    await audit(
      db,
      actorId,
      existing ? "product.updated" : "product.created",
      id,
      { slug: value.slug },
    );
    return (await productRows(db, true)).find((p) => p.id === id)!;
  });
}
export async function getStaffProducts(actorId: string): Promise<Product[]> {
  await initCore();
  const db = await database();
  await staff(db, actorId);
  return productRows(db, true);
}
export async function setInventory(
  actorId: string,
  variantId: string,
  quantity: number,
  branchId = "main",
) {
  await initCore();
  parse(z.number().int().min(0).max(1000000), quantity);
  parse(z.string().regex(/^[a-z0-9_-]{1,64}$/), branchId);
  return transaction(async (db) => {
    await staff(db, actorId);
    const [variant] = await db.query("SELECT id FROM variants WHERE id=$1", [
      variantId,
    ]);
    if (!variant) fail(404, "NOT_FOUND", "Вариант не найден");
    await db.query(
      "INSERT INTO inventory(variant_id,branch_id,quantity,reserved) VALUES($1,$2,0,0) ON CONFLICT DO NOTHING",
      [variantId, branchId],
    );
    const [row] = await db.query(
      "SELECT * FROM inventory WHERE variant_id=$1 AND branch_id=$2 FOR UPDATE",
      [variantId, branchId],
    );
    if (quantity < row.reserved)
      fail(409, "RESERVED_STOCK", "Нельзя уменьшить остаток ниже резерва");
    await db.query(
      "UPDATE inventory SET quantity=$1 WHERE variant_id=$2 AND branch_id=$3",
      [quantity, variantId, branchId],
    );
    await audit(db, actorId, "inventory.updated", variantId, {
      branchId,
      before: row.quantity,
      quantity,
    });
    return {
      variantId,
      branchId,
      quantity,
      reserved: row.reserved,
      available: quantity - row.reserved,
    };
  });
}
export async function getInventory(actorId: string) {
  await initCore();
  const db = await database();
  await staff(db, actorId);
  return (
    await db.query("SELECT * FROM inventory ORDER BY branch_id,variant_id")
  ).map((r) => ({
    variantId: r.variant_id,
    branchId: r.branch_id,
    quantity: r.quantity,
    reserved: r.reserved,
    available: r.quantity - r.reserved,
  }));
}
export async function listOrders(actorId: string): Promise<Order[]> {
  await initCore();
  const db = await database();
  await staff(db, actorId);
  const rows = await db.query(
    "SELECT * FROM orders ORDER BY created_at DESC LIMIT 1000",
  );
  return Promise.all(rows.map((row) => orderView(db, row)));
}
async function releaseStock(db: DB, orderId: string, consume = false) {
  const rows = await db.query(
    "SELECT * FROM reservations WHERE order_id=$1 AND state='reserved' ORDER BY variant_id,branch_id FOR UPDATE",
    [orderId],
  );
  for (const row of rows) {
    await db.query(
      "SELECT variant_id FROM inventory WHERE variant_id=$1 AND branch_id=$2 FOR UPDATE",
      [row.variant_id, row.branch_id],
    );
    await db.query(
      `UPDATE inventory SET reserved=reserved-$1${consume ? ",quantity=quantity-$1" : ""} WHERE variant_id=$2 AND branch_id=$3`,
      [row.quantity, row.variant_id, row.branch_id],
    );
    await db.query(
      "UPDATE reservations SET state=$1 WHERE order_id=$2 AND variant_id=$3 AND branch_id=$4",
      [
        consume ? "consumed" : "released",
        orderId,
        row.variant_id,
        row.branch_id,
      ],
    );
  }
}
export async function advanceOrder(
  actorId: string,
  id: string,
  status: string,
): Promise<Order> {
  await initCore();
  return transaction(async (db) => {
    await staff(db, actorId);
    const [row] = await db.query(
      "SELECT * FROM orders WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!row) fail(404, "NOT_FOUND", "Заказ не найден");
    const transitions: Record<string, string[]> = {
      awaiting_payment: ["cancelled"],
      paid: ["processing", "cancelled"],
      processing: ["ready", "cancelled"],
      ready: ["completed", "cancelled"],
      manual_review: [],
    };
    if (!(transitions[row.status] || []).includes(status))
      fail(409, "INVALID_TRANSITION", "Недопустимый переход статуса");
    if (status === "cancelled" && row.status === "awaiting_payment") {
      const [payment] = await db.query(
        "SELECT * FROM payments WHERE order_id=$1",
        [id],
      );
      if (!["cancelled", "expired"].includes(payment?.status))
        fail(
          409,
          "PROVIDER_CONFIRMATION_REQUIRED",
          "Сначала дождитесь подтверждения отмены от платёжного провайдера",
        );
      await releaseStock(db, id);
    }
    if (
      status === "cancelled" &&
      ["paid", "processing", "ready"].includes(row.status)
    )
      status = "refund_required";
    await db.query("UPDATE orders SET status=$1 WHERE id=$2", [status, id]);
    await audit(db, actorId, "order.status", id, {
      from: row.status,
      to: status,
    });
    return orderView(db, { ...row, status });
  });
}
export async function listUsers(actorId: string): Promise<User[]> {
  await initCore();
  const db = await database();
  await staff(db, actorId, true);
  return (
    await db.query("SELECT * FROM users ORDER BY created_at DESC LIMIT 1000")
  ).map(user);
}
export async function createStaff(
  actorId: string,
  input: { email: string; password: string; role: "manager" | "owner" },
): Promise<User> {
  await initCore();
  const value = parse(
    z.object({
      email: emailSchema,
      password: passwordSchema,
      role: z.enum(["manager", "owner"]),
    }),
    input,
  );
  const passwordHash = await hash(value.password);
  return transaction(async (db) => {
    await staff(db, actorId, true);
    const [existing] = await db.query("SELECT id FROM users WHERE email=$1", [
      value.email,
    ]);
    if (existing) fail(409, "EMAIL_EXISTS", "Этот email уже используется");
    const id = randomUUID();
    const [row] = await db.query(
      "INSERT INTO users(id,email,password_hash,role,must_change_password,temporary_password_expires_at) VALUES($1,$2,$3,$4,true,$5) RETURNING *",
      [
        id,
        value.email,
        passwordHash,
        value.role,
        new Date(Date.now() + 86400000),
      ],
    );
    await audit(db, actorId, "staff.created", id, {
      email: value.email,
      role: value.role,
    });
    return user(row);
  });
}
export async function listAudit(actorId: string) {
  await initCore();
  const db = await database();
  await staff(db, actorId, true);
  return db.query("SELECT * FROM audit ORDER BY created_at DESC LIMIT 500");
}
export async function getInvoiceOrder(orderId: string): Promise<{
  id: string;
  total: number;
  isDemo: boolean;
  environment: string;
  email: string;
  phone: string;
} | null> {
  await initCore();
  const [row] = await (
    await database()
  ).query(
    "SELECT o.*,p.environment FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.id=$1 AND p.method='apipay'",
    [orderId],
  );
  if (!row) return null;
  return {
    id: row.id,
    total: row.total,
    isDemo: row.lines.some((l: OrderLine) => l.isDemo),
    environment: row.environment,
    email: row.email,
    phone: row.phone,
  };
}
export async function recordInvoice(
  orderId: string,
  input: {
    invoiceId: string;
    paymentUrl: string | null;
    environment: string;
    amount: number;
  },
) {
  await initCore();
  const value = parse(
    z.object({
      invoiceId: z.string().min(1).max(256),
      paymentUrl: z
        .string()
        .url()
        .refine((v) => {
          const u = new URL(v);
          return (
            u.protocol === "https:" ||
            (process.env.APP_ENV !== "production" &&
              ["http:"].includes(u.protocol) &&
              ["localhost", "127.0.0.1"].includes(u.hostname))
          );
        })
        .nullable(),
      environment: z.enum(["mock", "sandbox", "production"]),
      amount: z.number().int().min(1),
    }),
    input,
  );
  return transaction(async (db) => {
    const [order] = await db.query(
      "SELECT * FROM orders WHERE id=$1 FOR UPDATE",
      [orderId],
    );
    const [payment] = await db.query(
      "SELECT * FROM payments WHERE order_id=$1 FOR UPDATE",
      [orderId],
    );
    if (!order || !payment || payment.method !== "apipay")
      fail(404, "NOT_FOUND", "Заказ не найден");
    if (
      payment.amount !== value.amount ||
      payment.environment !== value.environment
    )
      fail(409, "PAYMENT_MISMATCH", "Несовпадение параметров платежа");
    if (
      value.environment === "production" &&
      order.lines.some((l: OrderLine) => l.isDemo)
    )
      fail(409, "DEMO_PAYMENT_BLOCKED", "Demo payment blocked");
    if (payment.invoice_id && payment.invoice_id !== value.invoiceId)
      fail(409, "INVOICE_EXISTS", "Платёжный счёт уже создан");
    await db.query(
      "UPDATE payments SET invoice_id=$1,payment_url=$2 WHERE order_id=$3",
      [value.invoiceId, value.paymentUrl, orderId],
    );
    return { ok: true };
  });
}
export interface PaymentEvent {
  eventId: string;
  orderId: string;
  invoiceId: string;
  amount: number;
  environment: string;
  status:
    | "paid"
    | "cancelled"
    | "expired"
    | "refunded"
    | "partially_refunded"
    | "error"
    | "pending";
}
export async function processPaymentEvent(
  input: PaymentEvent,
): Promise<{ status: string; duplicate: boolean }> {
  await initCore();
  const value = parse(
    z.object({
      eventId: z.string().min(1).max(300),
      orderId: z.string().min(1).max(128),
      invoiceId: z.string().min(1).max(256),
      amount: z.number().int().min(1),
      environment: z.enum(["mock", "sandbox", "production"]),
      status: z.enum([
        "paid",
        "cancelled",
        "expired",
        "refunded",
        "partially_refunded",
        "error",
        "pending",
      ]),
    }),
    input,
  );
  return transaction(async (db) => {
    const [order] = await db.query(
      "SELECT * FROM orders WHERE id=$1 FOR UPDATE",
      [value.orderId],
    );
    if (!order) fail(404, "NOT_FOUND", "Заказ не найден");
    const [payment] = await db.query(
      "SELECT * FROM payments WHERE order_id=$1 FOR UPDATE",
      [value.orderId],
    );
    if (
      !payment ||
      payment.method !== "apipay" ||
      payment.amount !== value.amount ||
      payment.environment !== value.environment ||
      (payment.invoice_id && payment.invoice_id !== value.invoiceId)
    )
      fail(409, "PAYMENT_MISMATCH", "Платёж не соответствует заказу");
    if (!payment.invoice_id)
      await db.query("UPDATE payments SET invoice_id=$1 WHERE order_id=$2", [
        value.invoiceId,
        order.id,
      ]);
    if (
      value.environment === "production" &&
      order.lines.some((l: OrderLine) => l.isDemo)
    )
      fail(409, "DEMO_PAYMENT_BLOCKED", "Demo payment blocked");
    const [seen] = await db.query(
      "SELECT * FROM payment_events WHERE event_id=$1",
      [value.eventId],
    );
    if (seen) {
      if (seen.order_id !== value.orderId || seen.event_type !== value.status)
        fail(409, "EVENT_COLLISION", "Конфликт идентификатора события");
      return { status: order.status, duplicate: true };
    }
    await db.query(
      "INSERT INTO payment_events(event_id,order_id,event_type,payload) VALUES($1,$2,$3,$4::jsonb)",
      [value.eventId, value.orderId, value.status, JSON.stringify(value)],
    );
    let next = order.status;
    if (value.status === "paid") {
      if (["refunded", "partially_refunded"].includes(payment.status))
        next = order.status;
      else if (
        [
          "paid",
          "processing",
          "ready",
          "completed",
          "refund_required",
        ].includes(order.status)
      )
        next = order.status;
      else if (
        order.status === "awaiting_payment" &&
        new Date(order.expires_at).getTime() > Date.now()
      ) {
        await releaseStock(db, order.id, true);
        next = "paid";
      } else {
        await releaseStock(db, order.id);
        next = "manual_review";
      }
      if (!["refunded", "partially_refunded"].includes(payment.status))
        await db.query("UPDATE payments SET status='paid' WHERE order_id=$1", [
          order.id,
        ]);
    } else if (value.status === "refunded") {
      // Refunds do not restore stock: a manager must inspect physical returns.
      // A full refund may arrive before its paid event; release only stock that
      // remains reserved, never goods already consumed by a paid order.
      await releaseStock(db, order.id);
      if (!["paid", "partially_refunded", "refunded"].includes(payment.status))
        next = "manual_review";
      else next = "refunded";
      await db.query(
        "UPDATE payments SET status='refunded' WHERE order_id=$1",
        [order.id],
      );
    } else if (value.status === "partially_refunded") {
      // Partial refunds need explicit human review; inventory and fulfillment stay untouched.
      // A delayed partial notification cannot undo a verified full refund.
      if (payment.status !== "refunded") {
        next =
          order.status === "refund_required"
            ? "refund_required"
            : "manual_review";
        await db.query(
          "UPDATE payments SET status='partially_refunded' WHERE order_id=$1",
          [order.id],
        );
      }
    } else if (value.status === "pending" || value.status === "error") {
      // Nonterminal notifications never release a stock reservation.
    } else if (
      !["paid", "partially_refunded", "refunded"].includes(payment.status)
    ) {
      if (order.status === "awaiting_payment") {
        await releaseStock(db, order.id);
        next = value.status;
      }
      await db.query("UPDATE payments SET status=$1 WHERE order_id=$2", [
        value.status,
        order.id,
      ]);
    }
    await db.query("UPDATE orders SET status=$1 WHERE id=$2", [next, order.id]);
    await audit(db, null, "payment.event", order.id, {
      eventId: value.eventId,
      status: value.status,
      result: next,
    });
    return { status: next, duplicate: false };
  });
}
export async function listPendingInvoices(): Promise<
  Array<{
    orderId: string;
    invoiceId: string;
    amount: number;
    environment: "mock" | "sandbox" | "production";
  }>
> {
  await initCore();
  return transaction(async (db) => {
    const active =
      "(p.status IN ('pending','error','partially_refunded') OR o.status IN ('awaiting_payment','refund_required','manual_review'))";
    const select = (
      condition: string,
      limit: number,
      excluded: string[] = [],
    ) =>
      db.query(
        `SELECT p.id,p.order_id,p.invoice_id,p.amount,p.environment
       FROM payments p JOIN orders o ON o.id=p.order_id
       WHERE p.method='apipay' AND p.invoice_id IS NOT NULL AND p.status<>'refunded'
         AND (${condition}) AND NOT(p.id=ANY($2::text[]))
       ORDER BY p.last_checked_at ASC NULLS FIRST,p.created_at ASC,p.id ASC
       LIMIT $1 FOR UPDATE OF p SKIP LOCKED`,
        [limit, excluded],
      );
    // Keep capacity for both urgent orders and historical invoices. Each queue
    // rotates by a persisted timestamp, so neither can be crowded out forever.
    const rows = [
      ...(await select(active, 30)),
      ...(await select(`NOT ${active}`, 20)),
    ];
    if (rows.length < 50)
      rows.push(
        ...(await select(
          "true",
          50 - rows.length,
          rows.map((row) => row.id),
        )),
      );
    if (rows.length)
      await db.query(
        "UPDATE payments SET last_checked_at=now() WHERE id=ANY($1::text[])",
        [rows.map((row) => row.id)],
      );
    return rows.map((r) => ({
      orderId: r.order_id,
      invoiceId: r.invoice_id,
      amount: r.amount,
      environment: r.environment,
    }));
  });
}
/** Live reservations are released only by a verified provider cancellation/expiration event.
 * A wall-clock deadline is never proof that the provider did not accept money. */
export async function expireReservations(): Promise<number> {
  await initCore();
  return 0;
}
export async function claimJob(workerId = "worker"): Promise<Job | null> {
  await initCore();
  return transaction(async (db) => {
    await db.query(
      "UPDATE jobs SET status='failed',locked_at=NULL,locked_by=NULL,last_error='Worker lease expired after final attempt' WHERE status='running' AND locked_at<now()-interval '5 minutes' AND attempts>=8",
    );
    const [row] = await db.query(
      "SELECT * FROM jobs WHERE (status='pending' AND available_at<=now()) OR (status='running' AND locked_at<now()-interval '5 minutes') ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1",
    );
    if (!row) return null;
    await db.query(
      "UPDATE jobs SET status='running',locked_at=now(),locked_by=$1,attempts=attempts+1 WHERE id=$2",
      [workerId, row.id],
    );
    return {
      id: row.id,
      type: row.type,
      payload: row.payload,
      attempts: row.attempts + 1,
    };
  });
}
export async function finishJob(id: string, workerId?: string) {
  await initCore();
  await (
    await database()
  ).query(
    "UPDATE jobs SET status='done',locked_at=NULL,locked_by=NULL,payload='{}'::jsonb WHERE id=$1 AND status='running' AND ($2::text IS NULL OR locked_by=$2)",
    [id, workerId ?? null],
  );
}
export async function failJob(id: string, error: string, workerId?: string) {
  await initCore();
  await (
    await database()
  ).query(
    "UPDATE jobs SET status=CASE WHEN attempts>=8 THEN 'failed' ELSE 'pending' END,available_at=now()+(LEAST(3600,POWER(2,attempts)*15)||' seconds')::interval,locked_at=NULL,locked_by=NULL,last_error=$1 WHERE id=$2 AND status='running' AND ($3::text IS NULL OR locked_by=$3)",
    [error.slice(0, 1000), id, workerId ?? null],
  );
}

export const getCustomerOrders = getUserOrders;

export async function retryPayment(
  orderId: string,
  auth: { visitorId?: string; userId?: string; accessToken?: string },
) {
  await initCore();
  if (!(await getOrder(orderId, auth)))
    fail(404, "NOT_FOUND", "Заказ не найден");
  return transaction(async (db) => {
    const [order] = await db.query(
      "SELECT * FROM orders WHERE id=$1 FOR UPDATE",
      [orderId],
    );
    const [payment] = await db.query(
      "SELECT * FROM payments WHERE order_id=$1 FOR UPDATE",
      [orderId],
    );
    if (
      payment?.method !== "apipay" ||
      order.status !== "awaiting_payment" ||
      new Date(order.expires_at).getTime() <= Date.now()
    )
      fail(409, "PAYMENT_NOT_RETRYABLE", "Срок создания платежа истёк");
    if (payment.invoice_id) return orderView(db, order);
    const [job] = await db.query(
      "SELECT * FROM jobs WHERE type='create_invoice' AND payload->>'orderId'=$1 ORDER BY available_at DESC LIMIT 1 FOR UPDATE",
      [orderId],
    );
    if (job && ["pending", "running"].includes(job.status))
      return orderView(db, order);
    if (job)
      await db.query(
        "UPDATE jobs SET status='pending',attempts=0,available_at=now(),last_error=NULL WHERE id=$1",
        [job.id],
      );
    else await enqueue(db, "create_invoice", { orderId });
    return orderView(db, order);
  });
}
export async function listJobs(actorId: string) {
  await initCore();
  const db = await database();
  await staff(db, actorId, true);
  const rows = await db.query(
    "SELECT id,type,status,attempts,available_at,locked_at,last_error FROM jobs ORDER BY available_at DESC LIMIT 200",
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    attempts: r.attempts,
    availableAt: date(r.available_at),
    lockedAt: r.locked_at ? date(r.locked_at) : null,
    lastError: r.last_error,
  }));
}

export async function getStaffInsights(actorId: string, input: { days?: number } = {}): Promise<import("./types").StaffInsights> {
  await initCore();
  const db = await database();
  await staff(db, actorId);
  const { days } = parse(z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(365)]).default(30) }), input);
  return queryStaffInsights(db, days);
}

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { database, transaction, type DB, type Row } from "./db";
import {
  CoreError,
  type PaymentEnvironment,
  type Wallet,
  type WalletTopup,
} from "./types";
import { initCore } from "./index";

const error = (status: number, code: string, message: string): never => {
  throw new CoreError(status, code, message);
};
const hash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(value, Object.keys(value as object).sort()))
    .digest("hex");
const iso = (value: unknown) => new Date(value as string).toISOString();
export function walletEnvironment(): PaymentEnvironment {
  const mode = process.env.APIPAY_MODE || "mock";
  if (
    !["mock", "sandbox", "production"].includes(mode) ||
    (mode === "mock" && process.env.APP_ENV === "production")
  )
    return error(503, "WALLET_UNAVAILABLE", "Кошелёк временно недоступен");
  return mode as PaymentEnvironment;
}
export function walletFundingAvailable() {
  const mode = walletEnvironment();
  if (mode === "mock") return true;
  return Boolean(
    process.env.APIPAY_API_KEY &&
    process.env.APIPAY_WEBHOOK_SECRET &&
    (mode !== "production" || process.env.WALLET_PRODUCTION_ENABLED === "true"),
  );
}
export async function requireWalletCustomer(db: DB, userId: string) {
  const [user] = await db.query(
    "SELECT * FROM users WHERE id=$1 AND role='customer' FOR SHARE",
    [userId],
  );
  if (!user) error(401, "UNAUTHORIZED", "Войдите в кабинет");
  if (user.must_change_password)
    error(403, "PASSWORD_CHANGE_REQUIRED", "Измените временный пароль");
  return user;
}
async function lockWallet(
  db: DB,
  userId: string,
  environment: PaymentEnvironment,
) {
  await db.query(
    "INSERT INTO wallets(user_id,environment) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [userId, environment],
  );
  const [row] = await db.query(
    "SELECT * FROM wallets WHERE user_id=$1 AND environment=$2 FOR UPDATE",
    [userId, environment],
  );
  return row!;
}
function topupView(row: Row): WalletTopup {
  return {
    id: row.id,
    amount: row.amount,
    environment: row.environment,
    status: row.status,
    createdAt: iso(row.created_at),
    simulationAllowed:
      row.environment === "mock" && process.env.APP_ENV !== "production",
  };
}
export async function getWallet(userId: string): Promise<Wallet> {
  await initCore();
  const environment = walletEnvironment();
  return transaction(async (db) => {
    await requireWalletCustomer(db, userId);
    const row = await lockWallet(db, userId, environment);
    const entries = await db.query(
      "SELECT * FROM wallet_entries WHERE user_id=$1 AND environment=$2 ORDER BY created_at DESC,id DESC LIMIT 100",
      [userId, environment],
    );
    const topups = await db.query(
      "SELECT * FROM wallet_topups WHERE user_id=$1 AND environment=$2 ORDER BY created_at DESC,id DESC LIMIT 100",
      [userId, environment],
    );
    return {
      environment,
      currency: "KZT",
      balance: row.balance,
      frozen: row.frozen,
      topupAvailable: walletFundingAvailable() && !row.frozen,
      entries: entries.map((e) => ({
        id: e.id,
        kind: e.kind,
        amount: e.amount,
        balanceAfter: e.balance_after,
        createdAt: iso(e.created_at),
        ...(e.order_id ? { orderId: e.order_id } : {}),
        ...(e.topup_id ? { topupId: e.topup_id } : {}),
      })),
      topups: topups.map(topupView),
    };
  });
}
const topupSchema = z.object({
  amount: z.number().int().min(1).max(100000000),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{10,24}$/),
  idempotencyKey: z
    .string()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
});
export async function createWalletTopup(
  userId: string,
  input: { amount: number; phone: string; idempotencyKey: string },
): Promise<WalletTopup> {
  await initCore();
  const parsed = topupSchema.safeParse(input);
  if (!parsed.success)
    return error(400, "VALIDATION", "Проверьте сумму и номер телефона");
  const data = parsed.data,
    environment = walletEnvironment();
  return transaction(async (db) => {
    await requireWalletCustomer(db, userId);
    const wallet = await lockWallet(db, userId, environment);
    const [existing] = await db.query(
      "SELECT * FROM wallet_topups WHERE user_id=$1 AND environment=$2 AND idempotency_key=$3",
      [userId, environment, data.idempotencyKey],
    );
    if (existing) {
      if (existing.request_hash !== hash(data))
        error(409, "TOPUP_CHANGED", "Параметры пополнения изменились");
      return topupView(existing);
    }
    if (wallet.frozen)
      error(
        409,
        "WALLET_FROZEN",
        "Кошелёк временно заблокирован. Обратитесь в магазин",
      );
    if (!walletFundingAvailable())
      error(503, "WALLET_UNAVAILABLE", "Пополнение временно недоступно");
    const id = randomUUID();
    const [row] = await db.query(
      "INSERT INTO wallet_topups(id,user_id,environment,amount,phone,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [
        id,
        userId,
        environment,
        data.amount,
        data.phone,
        data.idempotencyKey,
        hash(data),
      ],
    );
    await db.query(
      "INSERT INTO jobs(id,type,payload,status) VALUES($1,'create_wallet_topup_invoice',$2::jsonb,'pending')",
      [randomUUID(), JSON.stringify({ topupId: id })],
    );
    return topupView(row!);
  });
}
export async function getWalletTopup(
  userId: string,
  id: string,
): Promise<WalletTopup> {
  await initCore();
  return transaction(async (db) => {
    await requireWalletCustomer(db, userId);
    const [row] = await db.query(
      "SELECT * FROM wallet_topups WHERE id=$1 AND user_id=$2 AND environment=$3",
      [id, userId, walletEnvironment()],
    );
    if (!row) return error(404, "NOT_FOUND", "Пополнение не найдено");
    return topupView(row);
  });
}
export async function getWalletTopupInvoice(id: string) {
  await initCore();
  const [row] = await (
    await database()
  ).query("SELECT * FROM wallet_topups WHERE id=$1", [id]);
  if (!row || row.invoice_id || row.status !== "pending") return null;
  if (row.environment !== walletEnvironment() || !walletFundingAvailable())
    error(503, "WALLET_UNAVAILABLE", "Пополнение временно недоступно");
  return {
    id: row.id,
    phone: row.phone,
    total: row.amount,
    environment: row.environment as PaymentEnvironment,
    isDemo: false,
  };
}
export async function recordWalletTopupInvoice(
  id: string,
  input: { invoiceId: string; amount: number; environment: string },
) {
  await initCore();
  return transaction(async (db) => {
    const [row] = await db.query(
      "SELECT * FROM wallet_topups WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (
      !row ||
      !input.invoiceId ||
      row.amount !== input.amount ||
      row.environment !== input.environment ||
      (row.invoice_id && row.invoice_id !== input.invoiceId)
    )
      error(409, "PAYMENT_MISMATCH", "Платёж не соответствует пополнению");
    await db.query("UPDATE wallet_topups SET invoice_id=$1 WHERE id=$2", [
      input.invoiceId,
      id,
    ]);
  });
}
export interface WalletTopupEvent {
  eventId: string;
  topupId: string;
  invoiceId: string;
  amount: number;
  environment: string;
  status: string;
  refundedAmount?: number;
}
const eventSchema = z.object({
  eventId: z.string().min(1).max(300),
  topupId: z.string().uuid(),
  invoiceId: z.string().min(1).max(256),
  amount: z.number().int().min(1).max(100000000),
  environment: z.enum(["mock", "sandbox", "production"]),
  status: z.enum([
    "paid",
    "pending",
    "error",
    "cancelled",
    "expired",
    "refunded",
    "partially_refunded",
  ]),
  refundedAmount: z.number().min(0).optional(),
});
export async function isWalletTopupId(id: string) {
  await initCore();
  return Boolean(
    (
      await (
        await database()
      ).query("SELECT id FROM wallet_topups WHERE id=$1", [id])
    ).length,
  );
}
async function entry(
  db: DB,
  wallet: Row,
  kind: string,
  amount: number,
  reference: { topupId?: string; orderId?: string },
  credit: boolean,
) {
  const [updated] = await db.query(
    `UPDATE wallets SET balance=balance${credit ? "+" : "-"}$1 WHERE user_id=$2 AND environment=$3 AND ${credit ? "balance <= 2147483647-$1" : "balance >= $1"} RETURNING *`,
    [amount, wallet.user_id, wallet.environment],
  );
  if (!updated)
    error(
      409,
      credit ? "WALLET_LIMIT" : "INSUFFICIENT_FUNDS",
      credit ? "Превышен лимит кошелька" : "Недостаточно средств на балансе",
    );
  await db.query(
    "INSERT INTO wallet_entries(id,user_id,environment,kind,amount,balance_after,topup_id,order_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      randomUUID(),
      wallet.user_id,
      wallet.environment,
      kind,
      amount,
      updated.balance,
      reference.topupId || null,
      reference.orderId || null,
    ],
  );
  return updated;
}
export async function processWalletTopupEvent(input: WalletTopupEvent) {
  await initCore();
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success)
    return error(400, "VALIDATION", "Некорректное платёжное событие");
  const value = parsed.data;
  return transaction(async (db) => {
    // All money operations lock account first, then topup/order, preventing checkout/refund deadlocks.
    const [owner] = await db.query(
      "SELECT user_id,environment FROM wallet_topups WHERE id=$1",
      [value.topupId],
    );
    if (!owner) return error(404, "NOT_FOUND", "Пополнение не найдено");
    let wallet = await lockWallet(db, owner.user_id, owner.environment);
    const [row] = await db.query(
      "SELECT * FROM wallet_topups WHERE id=$1 FOR UPDATE",
      [value.topupId],
    );
    if (
      !row ||
      row.amount !== value.amount ||
      row.environment !== value.environment ||
      (row.invoice_id && row.invoice_id !== value.invoiceId)
    )
      error(409, "PAYMENT_MISMATCH", "Платёж не соответствует пополнению");
    const [seen] = await db.query(
      "SELECT * FROM wallet_topup_events WHERE event_id=$1",
      [value.eventId],
    );
    if (
      seen &&
      (seen.topup_id !== value.topupId || hash(seen.payload) !== hash(value))
    )
      error(409, "EVENT_COLLISION", "Конфликт платёжного события");
    if (seen?.resolved)
      return { status: row.status, duplicate: true, resolved: true };
    if (!row.invoice_id)
      await db.query("UPDATE wallet_topups SET invoice_id=$1 WHERE id=$2", [
        value.invoiceId,
        row.id,
      ]);
    if (!seen)
      await db.query(
        "INSERT INTO wallet_topup_events(event_id,topup_id,event_type,payload) VALUES($1,$2,$3,$4::jsonb)",
        [value.eventId, row.id, value.status, JSON.stringify(value)],
      );
    const [credit] = await db.query(
      "SELECT * FROM wallet_entries WHERE topup_id=$1 AND kind='topup_credit'",
      [row.id],
    );
    let status = row.status,
      resolved = true;
    if (value.status === "paid") {
      if (!["refunded", "manual_review"].includes(status)) {
        if (!credit)
          wallet = await entry(
            db,
            wallet,
            "topup_credit",
            row.amount,
            { topupId: row.id },
            true,
          );
        status = "paid";
      }
    } else if (
      value.status === "refunded" ||
      value.status === "partially_refunded"
    ) {
      const cumulative =
        value.status === "refunded" ? row.amount : value.refundedAmount;
      if (
        cumulative === undefined ||
        !Number.isSafeInteger(cumulative) ||
        cumulative > row.amount
      ) {
        resolved = false;
        status = "manual_review";
      } else {
        const target = Math.max(row.refunded_amount, cumulative);
        await db.query(
          "UPDATE wallet_topups SET refunded_amount=$1 WHERE id=$2",
          [target, row.id],
        );
        const [reversed] = await db.query(
          "SELECT COALESCE(sum(amount),0)::integer AS amount FROM wallet_entries WHERE topup_id=$1 AND kind='topup_reversal'",
          [row.id],
        );
        const needed = credit ? target - reversed!.amount : 0;
        if (needed > wallet.balance) {
          resolved = false;
          status = "manual_review";
        } else {
          if (needed > 0)
            wallet = await entry(
              db,
              wallet,
              "topup_reversal",
              needed,
              { topupId: row.id },
              false,
            );
          // A refund preceding payment must never be credited by a delayed paid event.
          status = target === row.amount ? "refunded" : "manual_review";
          if (target < row.amount) resolved = false;
        }
      }
      if (!resolved)
        await db.query(
          "UPDATE wallets SET frozen=true WHERE user_id=$1 AND environment=$2",
          [row.user_id, row.environment],
        );
    } else if (
      !credit &&
      !["refunded", "manual_review"].includes(status) &&
      ["cancelled", "expired", "error"].includes(value.status)
    )
      status = value.status;
    await db.query("UPDATE wallet_topups SET status=$1 WHERE id=$2", [
      status,
      row.id,
    ]);
    await db.query(
      "UPDATE wallet_topup_events SET resolved=$1 WHERE event_id=$2",
      [resolved, value.eventId],
    );
    return { status, duplicate: Boolean(seen), resolved };
  });
}
export async function simulateWalletTopup(userId: string, id: string) {
  const topup = await getWalletTopup(userId, id);
  if (walletEnvironment() !== "mock" || process.env.APP_ENV === "production")
    error(404, "NOT_FOUND", "Пополнение не найдено");
  const invoiceId = `mock-${id}`;
  await recordWalletTopupInvoice(id, {
    invoiceId,
    amount: topup.amount,
    environment: "mock",
  });
  await processWalletTopupEvent({
    eventId: `mock-topup-paid:${id}`,
    topupId: id,
    invoiceId,
    amount: topup.amount,
    environment: "mock",
    status: "paid",
  });
  return getWalletTopup(userId, id);
}
export async function listPendingWalletTopupInvoices() {
  await initCore();
  return transaction(async (db) => {
    const rows = await db.query(
      "SELECT * FROM wallet_topups WHERE invoice_id IS NOT NULL AND status<>'refunded' ORDER BY last_checked_at ASC NULLS FIRST,created_at,id LIMIT 50 FOR UPDATE SKIP LOCKED",
    );
    if (rows.length)
      await db.query(
        "UPDATE wallet_topups SET last_checked_at=now() WHERE id=ANY($1::text[])",
        [rows.map((r) => r.id)],
      );
    return rows.map((r) => ({
      topupId: r.id,
      invoiceId: r.invoice_id,
      amount: r.amount,
      environment: r.environment as PaymentEnvironment,
    }));
  });
}
/** Must run in checkout's transaction, before creating the order and taking inventory locks. */
export async function lockCheckoutWallet(
  db: DB,
  userId: string,
  environment: PaymentEnvironment,
) {
  await requireWalletCustomer(db, userId);
  if (environment === "production" && !walletFundingAvailable())
    error(503, "WALLET_UNAVAILABLE", "Оплата с баланса временно недоступна");
  const wallet = await lockWallet(db, userId, environment);
  if (wallet.frozen)
    error(
      409,
      "WALLET_FROZEN",
      "Кошелёк временно заблокирован. Обратитесь в магазин",
    );
  return wallet;
}
export async function debitCheckoutWallet(
  db: DB,
  wallet: Row,
  orderId: string,
  amount: number,
) {
  await entry(db, wallet, "order_debit", amount, { orderId }, false);
}
export async function refundWalletOrder(actorId: string, orderId: string) {
  await initCore();
  return transaction(async (db) => {
    const [actor] = await db.query(
      "SELECT * FROM users WHERE id=$1 AND role IN ('manager','owner') FOR SHARE",
      [actorId],
    );
    if (!actor) error(403, "FORBIDDEN", "Недостаточно прав");
    if (actor.must_change_password)
      error(403, "PASSWORD_CHANGE_REQUIRED", "Измените временный пароль");
    const [debit] = await db.query(
      "SELECT * FROM wallet_entries WHERE order_id=$1 AND kind='order_debit'",
      [orderId],
    );
    if (!debit)
      error(409, "INVALID_PAYMENT_METHOD", "Заказ не оплачен с баланса");
    const wallet = await lockWallet(db, debit.user_id, debit.environment);
    const [order] = await db.query(
      "SELECT * FROM orders WHERE id=$1 FOR UPDATE",
      [orderId],
    );
    const [payment] = await db.query(
      "SELECT * FROM payments WHERE order_id=$1 FOR UPDATE",
      [orderId],
    );
    if (
      !order ||
      !payment ||
      payment.method !== "wallet" ||
      order.user_id !== debit.user_id ||
      payment.amount !== debit.amount ||
      payment.environment !== debit.environment
    )
      error(409, "PAYMENT_MISMATCH", "Платёж не соответствует заказу");
    const [existing] = await db.query(
      "SELECT id FROM wallet_entries WHERE order_id=$1 AND kind='order_refund'",
      [orderId],
    );
    if (existing) return { ok: true, duplicate: true };
    if (
      !["paid", "processing", "ready", "completed", "refund_required"].includes(
        order.status,
      ) ||
      payment.status !== "paid"
    )
      error(409, "INVALID_TRANSITION", "Возврат недоступен");
    await entry(db, wallet, "order_refund", debit.amount, { orderId }, true);
    await db.query("UPDATE payments SET status='refunded' WHERE order_id=$1", [
      orderId,
    ]);
    await db.query("UPDATE orders SET status='refunded' WHERE id=$1", [
      orderId,
    ]);
    await db.query(
      "INSERT INTO audit(id,actor_id,action,entity_id,details) VALUES($1,$2,'wallet.order_refund',$3,$4::jsonb)",
      [
        randomUUID(),
        actorId,
        orderId,
        JSON.stringify({
          amount: debit.amount,
          environment: debit.environment,
        }),
      ],
    );
    return { ok: true, duplicate: false };
  });
}

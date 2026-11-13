import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import {
  initCore,
  claimJob,
  finishJob,
  failJob,
  decryptMailPayload,
  getInvoiceOrder,
  recordInvoice,
  processPaymentEvent,
  expireReservations,
  listPendingInvoices,
  getWalletTopupInvoice,
  recordWalletTopupInvoice,
  processWalletTopupEvent,
  listPendingWalletTopupInvoices,
} from "@urbanmag/core";
import { ApiPay, type Mode } from "./apipay.js";
import { walletInvoiceStatus } from "./wallet-status.js";

const mode = (process.env.APIPAY_MODE || "mock") as Mode;
const api = new ApiPay(mode);
const workerId = randomUUID();
const smtp = process.env.SMTP_URL
  ? nodemailer.createTransport(process.env.SMTP_URL)
  : null;
let stopped = false;
process.on("SIGTERM", () => {
  stopped = true;
});
process.on("SIGINT", () => {
  stopped = true;
});
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function handle(job: Awaited<ReturnType<typeof claimJob>> & {}) {
  if (job.type === "create_invoice") {
    const order = await getInvoiceOrder(String(job.payload.orderId));
    if (!order) throw new Error("Order unavailable");
    if (order.environment !== mode)
      throw new Error("Order and payment environment mismatch");
    const invoice = await api.create(order);
    await recordInvoice(order.id, {
      invoiceId: invoice.id,
      paymentUrl: null,
      environment: mode,
      amount: order.total,
    });
  } else if (job.type === "create_wallet_topup_invoice") {
    const topup = await getWalletTopupInvoice(String(job.payload.topupId));
    if (!topup) return;
    if (topup.environment !== mode)
      throw new Error("Topup environment mismatch");
    const invoice = await api.createInvoice({
      externalId: topup.id,
      phone: topup.phone,
      amount: topup.total,
      isDemo: false,
      description: `Urbanmag balance ${topup.id}`,
    });
    await recordWalletTopupInvoice(topup.id, {
      invoiceId: invoice.id,
      amount: topup.total,
      environment: mode,
    });
  } else if (job.type === "send_mail") {
    if (!smtp || !process.env.MAIL_FROM)
      throw new Error("SMTP is not configured");
    const mail = decryptMailPayload(job.payload);
    await smtp.sendMail({ from: process.env.MAIL_FROM, ...mail });
  } else throw new Error("Unknown job type");
}
async function reconcile() {
  await expireReservations();
  if (mode === "mock") return;
  for (const invoice of await listPendingWalletTopupInvoices()) {
    if (invoice.environment !== mode) continue;
    try {
      const remote = await api.get(invoice.invoiceId);
      const status = walletInvoiceStatus(remote);
      if (status) {
        if (
          String(remote.external_order_id) !== invoice.topupId ||
          Number(remote.amount) !== invoice.amount
        )
          continue;
        await processWalletTopupEvent({
          eventId: `poll-topup:${invoice.invoiceId}:${status}:${remote.total_refunded ?? "unknown"}`,
          topupId: invoice.topupId,
          invoiceId: invoice.invoiceId,
          amount: invoice.amount,
          environment: invoice.environment,
          status,
          ...(remote.total_refunded != null
            ? { refundedAmount: Number(remote.total_refunded) }
            : {}),
        });
      }
    } catch {
      console.error("Wallet invoice reconciliation failed");
    }
  }
  for (const invoice of await listPendingInvoices()) {
    if (invoice.environment !== mode) continue;
    try {
      const remote = await api.get(invoice.invoiceId);
      const statuses: Record<
        string,
        "paid" | "cancelled" | "expired" | "partially_refunded"
      > = {
        paid: "paid",
        cancelled: "cancelled",
        expired: "expired",
        partially_refunded: "partially_refunded",
      };
      const status = remote.is_fully_refunded
        ? "refunded"
        : statuses[remote.status];
      if (
        status &&
        String(remote.external_order_id) === invoice.orderId &&
        Number(remote.amount) === invoice.amount
      ) {
        await processPaymentEvent({
          eventId: `poll:${invoice.invoiceId}:${status}`,
          orderId: invoice.orderId,
          invoiceId: invoice.invoiceId,
          amount: invoice.amount,
          environment: invoice.environment,
          status,
        });
      }
    } catch {
      console.error("Invoice reconciliation failed");
    }
  }
}
await initCore();
let nextReconcile = 0;
while (!stopped) {
  try {
    if (Date.now() >= nextReconcile) {
      await reconcile();
      nextReconcile = Date.now() + 60000;
    }
    const job = await claimJob(workerId);
    if (!job) {
      await pause(2000);
      continue;
    }
    try {
      await handle(job);
      await finishJob(job.id, workerId);
    } catch {
      await failJob(
        job.id,
        "Job processing failed; check service configuration and provider status",
        workerId,
      );
    }
  } catch {
    console.error("Worker iteration failed");
    await pause(5000);
  }
}

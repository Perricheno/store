import type { Locale } from "./i18n";
import { buyerCopy } from "../components/buyer-copy";
export function buyerOrderStatus(order: { status: string; paymentStatus?: string }, locale: Locale): string {
  const copy = buyerCopy[locale];
  const states: Record<string, string> = {
    pending: copy.awaiting, created: copy.awaiting, awaiting_payment: copy.awaiting,
    paid: copy.paid, cancelled: copy.canceled, canceled: copy.canceled, failed: copy.paymentError,
    expired: copy.expired, refunded: copy.refunded, partially_refunded: copy.partiallyRefunded,
    processing: copy.processing, ready: copy.ready, completed: copy.completed,
    refund_required: { ru: "Ожидает возврата", kk: "Қайтару күтілуде", en: "Refund pending" }[locale],
    manual_review: { ru: "Проверяется магазином", kk: "Дүкен тексеруде", en: "Store review required" }[locale],
  };
  if (["refunded", "partially_refunded"].includes(order.paymentStatus || "")) return states[order.paymentStatus!];
  return states[order.status] || copy.processing;
}

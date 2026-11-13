import type { Invoice } from "./apipay.js";

/** Provider reads repair missed webhooks; nonterminal states do not settle money. */
export function walletInvoiceStatus(invoice: Invoice) {
  if (invoice.is_fully_refunded) return "refunded";
  if (Number(invoice.total_refunded) > 0) return "partially_refunded";
  switch (invoice.status) {
    case "paid":
    case "cancelled":
    case "expired":
    case "error":
    case "partially_refunded":
      return invoice.status;
    default:
      return undefined;
  }
}

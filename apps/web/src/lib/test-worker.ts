import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  claimJob,
  decryptMailPayload,
  finishJob,
  failJob,
  getInvoiceOrder,
  recordInvoice,
} from "@urbanmag/core";

// Only the isolated E2E environment writes mail to disk; production always uses SMTP in the worker.
export async function drainTestJobs() {
  if (
    process.env.APP_ENV !== "test" ||
    process.env.APIPAY_MODE !== "mock" ||
    !process.env.TEST_MAIL_DIR
  )
    return;
  for (let i = 0; i < 25; i++) {
    const job = await claimJob("e2e-web");
    if (!job) break;
    try {
      if (job.type === "create_invoice") {
        const order = await getInvoiceOrder(String(job.payload.orderId));
        if (order)
          await recordInvoice(order.id, {
            invoiceId: `mock-${order.id}`,
            paymentUrl: null,
            environment: "mock",
            amount: order.total,
          });
      } else if (job.type === "send_mail") {
        const mail = decryptMailPayload(job.payload);
        await mkdir(process.env.TEST_MAIL_DIR, {
          recursive: true,
          mode: 0o700,
        });
        await writeFile(
          join(process.env.TEST_MAIL_DIR, `${job.id}.json`),
          JSON.stringify(mail),
          { mode: 0o600 },
        );
      } else throw new Error("Unsupported test job");
      await finishJob(job.id, "e2e-web");
    } catch {
      await failJob(job.id, "Test job failed", "e2e-web");
    }
  }
}

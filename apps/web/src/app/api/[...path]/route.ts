import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import * as core from "@urbanmag/core";
import {
  assertOrigin,
  body,
  cookieName,
  cookieOptions,
  currentUser,
  rateLimit,
  realm,
  requireStaff,
  sessionToken,
  visitorId,
} from "@/lib/http";
import { checkoutEnabled, isLocale, indexingEnabled } from "@/lib/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { publicCatalog, publicCart } from "@/lib/public-catalog";
import { drainTestJobs } from "@/lib/test-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
function publicOrder(order: core.Order) {
  return {
    ...order,
    number: order.id.slice(0, 8).toUpperCase(),
    isDemo: order.lines.some((l) => l.isDemo),
    simulationAllowed:
      process.env.APP_ENV !== "production" &&
      process.env.APIPAY_MODE === "mock" &&
      order.paymentMethod !== "wallet",
  };
}
async function handler(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await context.params).path
      .join("/")
      .replace(/^staff\/auth\//, "auth/");
    const method = request.method;
    if (path === "health") {
      await core.initCore();
      return json({
        status: "ok",
        environment: process.env.APP_ENV || "development",
      });
    }
    if (path === "webhooks/apipay" && method === "POST")
      return webhook(request);
    if (method !== "GET") assertOrigin(request);
    if (path.startsWith("media/") && method === "GET") {
      const name = path.slice(6);
      if (!/^[a-f0-9]{64}\.webp$/.test(name))
        return json({ error: "Not found" }, 404);
      try {
        const bytes = await readFile(
          join(process.env.UPLOADS_DIR || ".data/uploads", name),
        );
        return new Response(bytes, {
          headers: {
            "Content-Type": "image/webp",
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch {
        return json({ error: "Not found" }, 404);
      }
    }
    if (path === "products" && method === "GET") {
      const q = request.nextUrl.searchParams;
      return json(
        publicCatalog(
          await core.getCatalogPage({
            page: q.has("page") ? Number(q.get("page")) : 1,
            pageSize: q.has("pageSize") ? Number(q.get("pageSize")) : 24,
            q: q.get("q") || undefined,
            category: q.get("category") || undefined,
            gender: q.get("gender") || undefined,
            size: q.get("size") || undefined,
            minPrice: q.has("minPrice") ? Number(q.get("minPrice")) : undefined,
            maxPrice: q.has("maxPrice") ? Number(q.get("maxPrice")) : undefined,
            inStock:
              q.get("available") === "true" || q.get("inStock") === "true",
            sort: q.get("sort") || undefined,
          }),
        ),
      );
    }
    if (path === "settings" && method === "GET")
      return json({
        ...(await core.getSettings()),
        checkoutEnabled: checkoutEnabled(),
      });
    if (path === "cart") {
      const visitor = await visitorId();
      if (method === "GET")
        return json(publicCart(await core.getCart(visitor)));
      const input = await body(request);
      if (method !== "POST" && method !== "PATCH")
        throw new core.CoreError(405, "METHOD_NOT_ALLOWED", "Метод не поддерживается");
      return json(publicCart(await core.mutateCart(visitor, {
        variantId: input.variantId ?? undefined,
        productId: input.productId ?? undefined,
        selectVariantId: input.selectVariantId,
        quantity: Number(input.quantity),
        mode: method === "POST" ? "add" : "set",
      })));
    }
    if (path === "favorites") {
      const visitor = await visitorId();
      if (method !== "GET")
        await core.toggleFavorite(visitor, (await body(request)).productId);
      const products = (await core.getFavorites(visitor)).map(
        core.publicProduct,
      );
      return json({ products, productIds: products.map((p) => p.id) });
    }
    if (path === "checkout" && method === "POST") {
      if (!checkoutEnabled())
        throw new core.CoreError(
          503,
          "checkout_unavailable",
          "Оплата пока недоступна.",
        );
      rateLimit(request, "checkout", 10);
      const input = await body(request);
      const user = await currentUser();
      const result = await core.createCheckout(
        await visitorId(),
        { ...input, locale: isLocale(input.locale) ? input.locale : "ru" },
        user && !user.mustChangePassword ? user.id : undefined,
      );
      await drainTestJobs();
      if (result.accessToken)
        (await cookies()).set(
          await cookieName(`order_${result.order.id}`),
          result.accessToken,
          await cookieOptions(),
        );
      return json(publicOrder(result.order), 201);
    }
    if (path.startsWith("orders/")) {
      const [, id, action] = path.split("/");
      const user = await currentUser();
      const order = await core.getOrder(id, {
        visitorId: await visitorId(),
        userId: user && !user.mustChangePassword ? user.id : undefined,
        accessToken: (await cookies()).get(await cookieName(`order_${id}`))
          ?.value,
      });
      if (!order) throw new core.CoreError(404, "not_found", "Заказ не найден");
      if (action === "simulate" && method === "POST") {
        if (
          process.env.APP_ENV === "production" ||
          process.env.APIPAY_MODE !== "mock"
        )
          throw new core.CoreError(404, "not_found", "Not found");
        const invoiceId = `mock-${id}`;
        await core.recordInvoice(id, {
          invoiceId,
          paymentUrl: null,
          environment: "mock",
          amount: order.total,
        });
        await core.processPaymentEvent({
          eventId: `mock-paid:${id}`,
          orderId: id,
          invoiceId,
          amount: order.total,
          environment: "mock",
          status: "paid",
        });
        return json(
          publicOrder(
            (await core.getOrder(id, { visitorId: await visitorId() }))!,
          ),
        );
      }
      if (action === "payment" && method === "POST")
        return json(
          publicOrder(
            await core.retryPayment(id, {
              visitorId: await visitorId(),
              userId: user?.id,
              accessToken: (await cookies()).get(
                await cookieName(`order_${id}`),
              )?.value,
            }),
          ),
        );
      if (!action && method === "GET") return json(publicOrder(order));
    }
    if (path === "auth/me") return json({ user: await currentUser() });
    if (path === "auth/login" && method === "POST") {
      rateLimit(request, "login", 10);
      const input = await body(request);
      const r = await realm();
      const result = await core.createSession(input.email, input.password, r);
      (await cookies()).set(
        await cookieName(r),
        result.token,
        await cookieOptions(),
      );
      return json({ user: result.user });
    }
    if (path === "auth/logout" && method === "POST") {
      const token = await sessionToken();
      if (token) await core.destroySession(token);
      (await cookies()).delete(await cookieName(await realm()));
      return json({ ok: true });
    }
    if (path === "auth/password" && method === "PATCH") {
      const input = await body(request);
      const token = await sessionToken();
      if (!token)
        throw new core.CoreError(401, "unauthorized", "Войдите в кабинет");
      await core.changePassword(
        token,
        await realm(),
        input.currentPassword,
        input.newPassword,
      );
      return json({ ok: true, user: await currentUser() });
    }
    if (path === "auth/reset" && method === "POST") {
      rateLimit(request, "reset", 5);
      const input = await body(request);
      await core.requestPasswordReset(input.email, await realm());
      return json({ ok: true });
    }
    if (path === "auth/reset/confirm" && method === "POST") {
      const input = await body(request);
      await core.resetPassword(input.token, input.newPassword, await realm());
      return json({ ok: true });
    }
    if (path === "auth/claim" && method === "POST") {
      const input = await body(request);
      await core.claimAccount(input.token, input.newPassword);
      return json({ ok: true });
    }
    if (path === "wallet" || path.startsWith("wallet/")) {
      const user = await currentUser();
      if (!user || user.mustChangePassword)
        throw new core.CoreError(401, "UNAUTHORIZED", "Войдите в кабинет");
      if (path === "wallet" && method === "GET")
        return json(await core.getWallet(user.id));
      if (path === "wallet/topups" && method === "POST") {
        rateLimit(request, "wallet-topup", 10);
        const result = await core.createWalletTopup(
          user.id,
          await body(request),
        );
        await drainTestJobs();
        return json(result, 201);
      }
      const match = /^wallet\/topups\/([^/]+)(?:\/(simulate))?$/.exec(path);
      if (match && method === "GET" && !match[2])
        return json(await core.getWalletTopup(user.id, match[1]));
      if (match && method === "POST" && match[2] === "simulate")
        return json(await core.simulateWalletTopup(user.id, match[1]));
      return json({ error: "Not found" }, 404);
    }
    if (path === "account/orders" && method === "GET") {
      const user = await currentUser();
      if (!user || user.mustChangePassword)
        throw new core.CoreError(401, "unauthorized", "Войдите в кабинет");
      return json(await core.getCustomerOrders(user.id));
    }
    if (path.startsWith("staff/")) {
      const user = await requireStaff();
      if (path === "staff/uploads" && method === "POST") {
        if (
          Number(request.headers.get("content-length") || 0) >
          9 * 1024 * 1024
        )
          throw new core.CoreError(
            413,
            "too_large",
            "Изображение должно быть меньше 8 МБ",
          );
        const form = await request.formData();
        const file = form.get("file");
        if (
          !(file instanceof File) ||
          file.size > 8 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
            file.type,
          )
        )
          throw new core.CoreError(
            400,
            "invalid_image",
            "Выберите JPG, PNG, WebP или AVIF до 8 МБ",
          );
        const bytes = await sharp(Buffer.from(await file.arrayBuffer()), {
          limitInputPixels: 40_000_000,
        })
          .rotate()
          .resize(1800, 1800, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
        const name = `${createHash("sha256").update(bytes).digest("hex")}.webp`;
        const dir = process.env.UPLOADS_DIR || ".data/uploads";
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, name), bytes);
        return json({ url: `/api/media/${name}` });
      }
      if (path === "staff/status")
        return json({
          paymentMode: process.env.APIPAY_MODE || "mock",
          apiPayConfigured: !!process.env.APIPAY_API_KEY,
          smtpConfigured: !!process.env.SMTP_URL,
          database: process.env.DATABASE_URL
            ? "PostgreSQL"
            : "Embedded PostgreSQL",
          indexing: indexingEnabled(),
        });
      if (path === "staff/jobs") {
        await requireStaff(true);
        return json(await core.listJobs(user.id));
      }
      if (path === "staff/audit") {
        await requireStaff(true);
        return json(await core.listAudit(user.id));
      }
      if (path === "staff/products") {
        if (method === "GET")
          return json(await core.getProducts({ includeUnpublished: true }));
        return json(await core.upsertProduct(user.id, await body(request)));
      }
      if (path === "staff/inventory" && method === "GET")
        return json(await core.getInventory(user.id));
      if (path === "staff/inventory" && method === "PATCH") {
        const input = await body(request);
        await core.setInventory(
          user.id,
          input.variantId,
          input.quantity,
          input.branchId,
        );
        return json({ ok: true });
      }
      if (path === "staff/insights" && method === "GET") {
        await requireStaff();
        const days = new URL(request.url).searchParams.get("days");
        return json(await core.getStaffInsights(user.id, days === null ? {} : { days: Number(days) }));
      }
      if (
        /^staff\/orders\/[^/]+\/wallet-refund$/.test(path) &&
        method === "POST"
      )
        return json(await core.refundWalletOrder(user.id, path.split("/")[2]));
      if (path === "staff/orders") return json(await core.listOrders(user.id));
      if (/^staff\/orders\/[^/]+$/.test(path) && method === "PATCH") {
        const input = await body(request);
        await core.advanceOrder(user.id, path.split("/")[2], input.status);
        return json({ ok: true });
      }
      if (path === "staff/settings") {
        if (method === "GET") return json(await core.getSettings());
        await requireStaff(true);
        return json(await core.updateSettings(user.id, await body(request)));
      }
      if (path === "staff/users") {
        await requireStaff(true);
        if (method === "GET") return json(await core.listUsers(user.id));
        return json(await core.createStaff(user.id, await body(request)));
      }
    }
    return json({ error: "Not found" }, 404);
  } catch (error) {
    if (error instanceof core.CoreError)
      return json({ error: error.message, code: error.code }, error.status);
    if (
      error instanceof SyntaxError ||
      (error as { name?: string })?.name === "ZodError"
    )
      return json(
        { error: "Проверьте введённые данные", code: "validation_error" },
        400,
      );
    console.error(
      "Request failed",
      error instanceof Error
        ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[database]")
        : "unknown",
    );
    return json(
      {
        error: "Не удалось выполнить запрос. Попробуйте ещё раз.",
        code: "internal_error",
      },
      500,
    );
  }
}
async function webhook(request: NextRequest) {
  const secret = process.env.APIPAY_WEBHOOK_SECRET;
  if (!secret) return json({ error: "Webhook not configured" }, 503);
  const raw = await request.text();
  if (raw.length > 131072) return json({ error: "Too large" }, 413);
  const signature = request.headers.get("x-webhook-signature") || "";
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return json({ error: "Invalid signature" }, 401);
  const payload = JSON.parse(raw);
  if (payload.event === "webhook.test") return json({ ok: true });
  if (!["invoice.status_changed", "invoice.refunded"].includes(payload.event))
    return json({ ok: true });
  if (typeof payload.is_sandbox !== "boolean")
    return json({ error: "Missing environment" }, 400);
  const environment = payload.is_sandbox ? "sandbox" : "production";
  if (environment !== process.env.APIPAY_MODE) return json({ ok: true });
  const invoice = payload.invoice;
  if (!invoice?.id || !invoice.external_order_id)
    return json({ error: "Invalid invoice" }, 400);
  let status = invoice.status;
  if (payload.event === "invoice.refunded") {
    if (payload.refund?.status !== "completed") return json({ ok: true });
    status = invoice.is_fully_refunded ? "refunded" : "partially_refunded";
  }
  if (
    ![
      "paid",
      "cancelled",
      "expired",
      "refunded",
      "partially_refunded",
      "error",
      "pending",
    ].includes(status)
  )
    return json({ ok: true });
  const eventId = createHash("sha256").update(raw).digest("hex");
  if (await core.isWalletTopupId(String(invoice.external_order_id))) {
    await core.processWalletTopupEvent({
      eventId,
      topupId: String(invoice.external_order_id),
      invoiceId: String(invoice.id),
      amount: Number(invoice.amount),
      environment,
      status,
      ...(invoice.total_refunded != null
        ? { refundedAmount: Number(invoice.total_refunded) }
        : {}),
    });
    return json({ ok: true });
  }
  await core.processPaymentEvent({
    eventId: createHash("sha256").update(raw).digest("hex"),
    orderId: String(invoice.external_order_id),
    invoiceId: String(invoice.id),
    amount: Number(invoice.amount),
    environment,
    status,
  });
  return json({ ok: true });
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };

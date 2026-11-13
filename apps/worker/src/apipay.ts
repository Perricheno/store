export type Mode = "mock" | "sandbox" | "production";
export type Invoice = {
  id: string;
  status: string;
  is_sandbox?: boolean;
  is_fully_refunded?: boolean;
  total_refunded?: string | number;
  amount?: string | number;
  external_order_id?: string;
};
function validateMode(mode: string, appEnv: string | undefined): asserts mode is Mode {
  if (!["mock", "sandbox", "production"].includes(mode))
    throw new Error("Invalid APIPAY_MODE");
  if (mode === "mock" && appEnv === "production")
    throw new Error("Mock payments are forbidden in production");
}

/** A missing provider key leaves payment jobs pending without exhausting retries. */
export function configuredApiPay(
  mode: string,
  key: string,
  appEnv: string | undefined,
): { mode: Mode; api: ApiPay | null } {
  validateMode(mode, appEnv);
  return { mode, api: mode !== "mock" && !key.trim() ? null : new ApiPay(mode, key) };
}
export class ApiPay {
  private mode: Mode;
  private key: string;
  private base: string;
  private request: typeof fetch;
  constructor(
    mode: Mode,
    key = process.env.APIPAY_API_KEY || "",
    base = "https://api.apipay.kz/api/v1",
    request: typeof fetch = fetch,
  ) {
    this.mode = mode;
    this.key = key;
    this.base = base;
    this.request = request;
    validateMode(mode, process.env.APP_ENV);
    if (mode !== "mock" && !key.trim()) throw new Error("APIPAY_API_KEY is required");
  }
  private async call(path: string, init: RequestInit = {}) {
    const response = await this.request(`${this.base}${path}`, {
      ...init,
      headers: { "X-API-Key": this.key, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const data: any = await response.json().catch(() => ({}));
    return { response, data };
  }
  private async checkMode() {
    const { response, data } = await this.call("/account/health");
    if (!response.ok || data.mode !== this.mode)
      throw new Error(
        "ApiPay account mode cannot be verified or does not match configuration",
      );
  }
  async create(order: {
    id: string;
    phone: string;
    total: number;
    isDemo: boolean;
  }) {
    return this.createInvoice({
      externalId: order.id,
      phone: order.phone,
      amount: order.total,
      isDemo: order.isDemo,
      description: `Urbanmag ${order.id}`,
    });
  }
  async createInvoice(input: {
    externalId: string;
    phone: string;
    amount: number;
    isDemo: boolean;
    description: string;
  }) {
    const order = {
      id: input.externalId,
      phone: input.phone,
      total: input.amount,
      isDemo: input.isDemo,
    };
    if (!Number.isSafeInteger(order.total) || order.total <= 0)
      throw new Error("Invoice amount must be positive whole tenge");
    if (order.isDemo && this.mode === "production")
      throw new Error("Demo orders cannot use production payments");
    if (this.mode === "mock")
      return { id: `mock-${order.id}`, status: "pending" };
    await this.checkMode();
    const { response, data } = await this.call("/invoices", {
      method: "POST",
      body: JSON.stringify({
        phone_number: order.phone,
        amount: order.total,
        description: input.description.slice(0, 60),
        external_order_id: order.id,
        external_order_id_idempotency: order.id,
      }),
    });
    if (
      response.status === 409 &&
      data.error_code === "duplicate_idempotency_key" &&
      data.invoice_id != null
    )
      return { id: String(data.invoice_id), status: String(data.status) };
    if (response.status !== 201 || data.id == null)
      throw new Error(`ApiPay invoice request failed (${response.status})`);
    return { id: String(data.id), status: String(data.status || "processing") };
  }
  async get(id: string): Promise<Invoice> {
    if (this.mode === "mock") return { id, status: "pending" };
    const { response, data } = await this.call(
      `/invoices/${encodeURIComponent(id)}`,
    );
    if (!response.ok)
      throw new Error(`ApiPay invoice lookup failed (${response.status})`);
    if (
      typeof data.is_sandbox !== "boolean" ||
      data.is_sandbox !== (this.mode === "sandbox")
    )
      throw new Error("ApiPay invoice environment mismatch");
    return data as Invoice;
  }
}

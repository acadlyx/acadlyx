import { createHmac, timingSafeEqual } from "crypto";

import { env } from "../../config/env";
import { AppError } from "../../middleware/errorHandler";

export interface GatewayOrder {
  provider: string;
  orderId: string;
  amount: number;
  currency: string;
  publicKey: string | null;
  expiresAt: Date | null;
}

export interface GatewayVerification {
  provider: string;
  paymentId: string;
  orderId: string;
  amount: number;
  verified: boolean;
}

export interface GatewayWebhookPayment {
  provider: string;
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  invoiceId: string | null;
  institutionId: string | null;
}

export interface PaymentGateway {
  readonly name: string;
  readonly isConfigured: boolean;
  createOrder(input: {
    amount: number;
    currency: string;
    reference: string;
    notes?: Record<string, string>;
  }): Promise<GatewayOrder>;
  verifyCallback(payload: {
    orderId: string;
    paymentId: string;
    signature: string;
    amount: number;
  }): Promise<GatewayVerification>;
  verifyWebhook(rawBody: string, signature: string): boolean;
  parseWebhook(rawBody: string): Promise<GatewayWebhookPayment | null>;
}

function requireCredentials(provider: string): never {
  throw new AppError(
    `Online payments are not configured. Set PAYMENT_PROVIDER=${provider}, PAYMENT_KEY_ID and PAYMENT_KEY_SECRET.`,
    503
  );
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

class ManualGateway implements PaymentGateway {
  readonly name = "manual";
  readonly isConfigured = true;

  async createOrder(): Promise<GatewayOrder> {
    throw new AppError(
      "This institution is in offline payment mode. Record the payment at the counter instead.",
      400
    );
  }

  async verifyCallback(): Promise<GatewayVerification> {
    throw new AppError("No online payment provider is configured", 503);
  }

  verifyWebhook(): boolean {
    return false;
  }

  async parseWebhook(): Promise<GatewayWebhookPayment | null> {
    return null;
  }
}

class HmacGateway implements PaymentGateway {
  constructor(
    readonly name: string,
    private readonly keyId: string | undefined,
    private readonly keySecret: string | undefined,
    private readonly webhookSecret: string | undefined
  ) {}

  get isConfigured(): boolean {
    return Boolean(this.keyId && this.keySecret);
  }

  private signature(payload: string, secret: string): string {
    return createHmac("sha256", secret).update(payload).digest("hex");
  }

  private authorizationHeader(): string {
    if (!this.keyId || !this.keySecret) requireCredentials(this.name);
    return "Basic " + Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
  }

  private async razorpayGet<T>(path: string): Promise<T> {
    if (!this.isConfigured) requireCredentials(this.name);
    const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
      headers: {
        Authorization: this.authorizationHeader(),
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "provider error");
      throw new AppError(`Razorpay API request failed: ${detail.slice(0, 300)}`, 502);
    }
    return (await response.json()) as T;
  }

  async createOrder(input: {
    amount: number;
    currency: string;
    reference: string;
    notes?: Record<string, string>;
  }): Promise<GatewayOrder> {
    if (!this.isConfigured) requireCredentials(this.name);
    if (this.name !== "razorpay") {
      throw new AppError(
        `Online provider "${this.name}" is not implemented. Configure PAYMENT_PROVIDER=razorpay or manual.`,
        503
      );
    }

    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new AppError("Payment amount must be greater than zero", 400);
    }

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: this.authorizationHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(input.amount * 100),
        currency: input.currency,
        receipt: input.reference.slice(0, 40),
        notes: input.notes,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "provider error");
      throw new AppError(`Razorpay order creation failed: ${detail.slice(0, 300)}`, 502);
    }

    const data = (await response.json()) as {
      id?: string;
      amount?: number;
      currency?: string;
      created_at?: number;
    };

    if (!data.id || typeof data.amount !== "number" || !data.currency) {
      throw new AppError("Razorpay returned an invalid order response", 502);
    }

    return {
      provider: "razorpay",
      orderId: data.id,
      amount: data.amount / 100,
      currency: data.currency,
      publicKey: this.keyId || null,
      expiresAt: null,
    };
  }

  async verifyCallback(payload: {
    orderId: string;
    paymentId: string;
    signature: string;
    amount: number;
  }): Promise<GatewayVerification> {
    if (!this.isConfigured) requireCredentials(this.name);

    const expected = this.signature(
      `${payload.orderId}|${payload.paymentId}`,
      this.keySecret as string
    );

    if (!safeEqual(expected, payload.signature)) {
      return {
        provider: this.name,
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        amount: payload.amount,
        verified: false,
      };
    }

    if (this.name === "razorpay") {
      const payment = await this.razorpayGet<{
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
      }>(`payments/${encodeURIComponent(payload.paymentId)}`);

      const expectedAmount = Math.round(payload.amount * 100);
      const verified =
        payment.id === payload.paymentId &&
        payment.order_id === payload.orderId &&
        payment.status === "captured" &&
        payment.amount === expectedAmount;

      return {
        provider: "razorpay",
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        amount: payload.amount,
        verified,
      };
    }

    return {
      provider: this.name,
      paymentId: payload.paymentId,
      orderId: payload.orderId,
      amount: payload.amount,
      verified: true,
    };
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) return false;
    return safeEqual(this.signature(rawBody, this.webhookSecret), signature);
  }

  async parseWebhook(rawBody: string): Promise<GatewayWebhookPayment | null> {
    if (this.name !== "razorpay") return null;

    let body: {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            amount?: number;
            currency?: string;
            status?: string;
          };
        };
      };
    };

    try {
      body = JSON.parse(rawBody) as typeof body;
    } catch {
      throw new AppError("Invalid payment webhook payload", 400);
    }

    if (!["payment.captured", "payment.authorized"].includes(body.event || "")) {
      return null;
    }

    const payment = body.payload?.payment?.entity;
    if (
      !payment?.id ||
      !payment.order_id ||
      typeof payment.amount !== "number" ||
      !payment.currency
    ) {
      throw new AppError("Payment webhook is missing required payment fields", 400);
    }

    const order = await this.razorpayGet<{
      id?: string;
      amount?: number;
      currency?: string;
      notes?: Record<string, string>;
    }>(`orders/${encodeURIComponent(payment.order_id)}`);

    if (
      order.id !== payment.order_id ||
      order.amount !== payment.amount ||
      order.currency !== payment.currency
    ) {
      throw new AppError("Payment webhook does not match the provider order", 409);
    }

    return {
      provider: "razorpay",
      paymentId: payment.id,
      orderId: payment.order_id,
      amount: payment.amount / 100,
      currency: payment.currency,
      status: payment.status || "captured",
      invoiceId: order.notes?.invoiceId || null,
      institutionId: order.notes?.institutionId || null,
    };
  }
}

let cached: PaymentGateway | null = null;

export function getPaymentGateway(): PaymentGateway {
  if (cached) return cached;

  cached =
    env.paymentProvider === "manual"
      ? new ManualGateway()
      : new HmacGateway(
          env.paymentProvider,
          env.paymentKeyId,
          env.paymentKeySecret,
          env.paymentWebhookSecret
        );

  return cached;
}

export function paymentCurrency(): string {
  return env.paymentCurrency;
}

export function resetPaymentGateway(): void {
  cached = null;
}

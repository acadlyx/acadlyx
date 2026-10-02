import { createHmac, timingSafeEqual } from "crypto";

import { AppError } from "../../middleware/errorHandler";
import { env } from "../../config/env";

/**
 * Payment gateway abstraction.
 *
 * ACADLYX never calls a specific provider from a domain service. The fee
 * module asks for "the configured gateway" and receives an adapter that
 * satisfies this interface, so swapping Razorpay for Stripe, PayU or a
 * bank's own hosted page is a configuration change and an adapter file,
 * not a change to billing logic.
 *
 * Configure with:
 *   PAYMENT_PROVIDER = manual | razorpay | stripe
 *   PAYMENT_KEY_ID
 *   PAYMENT_KEY_SECRET
 *   PAYMENT_WEBHOOK_SECRET
 *   PAYMENT_CURRENCY (default INR)
 *
 * With PAYMENT_PROVIDER unset the platform runs in `manual` mode: cash,
 * cheque, NEFT and counter payments are recorded by staff and every
 * online-only endpoint fails with a clear configuration error rather
 * than pretending to have taken money.
 */

export interface GatewayOrder {
  provider: string;
  orderId: string;
  amount: number;
  currency: string;
  /** Safe to expose to the browser — never the secret. */
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
}

function requireCredentials(provider: string): never {
  throw new AppError(
    `Online payments are not configured. Set PAYMENT_PROVIDER=${provider}, PAYMENT_KEY_ID and PAYMENT_KEY_SECRET.`,
    503
  );
}

/** Constant-time comparison that tolerates length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Offline mode. Staff record cash/cheque/NEFT receipts; there is no
 * hosted checkout, so order creation fails loudly instead of silently
 * producing an unusable order.
 */
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
}

/**
 * HMAC-signature gateway covering the Razorpay-style contract
 * (`orderId|paymentId` signed with the API secret). Stripe and PayU use
 * the same shape with a different concatenation, which is why the
 * signing payload is the only provider-specific part.
 */
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

    if (!this.isConfigured) requireCredentials(this.name);

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64"),
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

    return {
      provider: this.name,
      paymentId: payload.paymentId,
      orderId: payload.orderId,
      amount: payload.amount,
      verified: safeEqual(expected, payload.signature),
    };
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) return false;
    return safeEqual(
      this.signature(rawBody, this.webhookSecret),
      signature
    );
  }
}

let cached: PaymentGateway | null = null;

export function getPaymentGateway(): PaymentGateway {
  if (cached) return cached;

  const provider = env.paymentProvider;

  cached =
    provider === "manual"
      ? new ManualGateway()
      : new HmacGateway(
          provider,
          env.paymentKeyId,
          env.paymentKeySecret,
          env.paymentWebhookSecret
        );

  return cached;
}

export function paymentCurrency(): string {
  return env.paymentCurrency;
}

/** Test seam: clears the memoised adapter. */
export function resetPaymentGateway(): void {
  cached = null;
}

import { Router } from "express";

import { env } from "../config/env";
import { getPaymentGateway } from "../services/payments/gateway";
import { settleProviderWebhook } from "../services/feeBilling.service";
import { asyncHandler } from "../utils/asyncHandler";
import { prisma } from "../lib/prisma";

const router = Router();

/**
 * Public provider callback. Authentication is intentionally not used:
 * Razorpay authenticates this request with the configured webhook HMAC.
 * The raw request body is captured by the global JSON parser in app.ts.
 */
router.post(
  "/razorpay",
  asyncHandler(async (req, res) => {
    if (env.paymentProvider !== "razorpay") {
      res.status(404).json({ success: false, message: "Payment provider is not enabled" });
      return;
    }

    const rawBody = (req as typeof req & { rawBody?: string }).rawBody;
    const signature = req.header("X-Razorpay-Signature") || "";

    if (!rawBody || !signature) {
      res.status(400).json({ success: false, message: "Missing webhook signature or raw body" });
      return;
    }

    const gateway = getPaymentGateway();
    if (!gateway.verifyWebhook(rawBody, signature)) {
      res.status(401).json({ success: false, message: "Invalid webhook signature" });
      return;
    }

    const payment = await gateway.parseWebhook(rawBody);
    if (!payment) {
      res.status(200).json({ success: true, ignored: true });
      return;
    }

    if (!payment.institutionId || !payment.invoiceId) {
      res.status(422).json({ success: false, message: "Webhook order is missing ACADLYX tenant metadata" });
      return;
    }

    const invoice = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "fee_invoices"
      WHERE "id" = ${payment.invoiceId}
        AND "institutionId" = ${payment.institutionId}
      LIMIT 1
    `;

    if (!invoice[0]) {
      res.status(404).json({ success: false, message: "Invoice not found for payment webhook" });
      return;
    }

    const result = await settleProviderWebhook(payment.institutionId, {
      invoiceId: payment.invoiceId,
      amount: payment.amount,
      provider: payment.provider,
      providerOrderId: payment.orderId,
      providerPaymentId: payment.paymentId,
    });

    res.status(200).json({ success: true, data: result });
  })
);

export default router;

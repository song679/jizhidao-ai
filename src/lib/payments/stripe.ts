import crypto from "node:crypto";
import Stripe from "stripe";
import type {
  CreatePaymentSessionInput,
  CreatePaymentSessionResult,
  PaymentProviderAdapter,
  VerifiedPaymentWebhook,
  VerifyPaymentWebhookInput,
} from "@/lib/payments/contract";

function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || "";
}

export function isStripeConfigured() {
  return Boolean(getStripeSecretKey() && process.env.STRIPE_WEBHOOK_SECRET);
}

export function getStripeCurrency() {
  return (process.env.STRIPE_CURRENCY || "cny").trim().toLowerCase();
}

function getStripeClient() {
  const secretKey = getStripeSecretKey();

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-06-24.dahlia",
  });
}

function getStripePaymentMethodTypes() {
  const configuredTypes =
    process.env.STRIPE_PAYMENT_METHOD_TYPES || "card,alipay,wechat_pay";

  return configuredTypes
    .split(",")
    .map((type) => type.trim())
    .filter(Boolean) as Stripe.Checkout.SessionCreateParams.PaymentMethodType[];
}
function digestPayload(rawBody: string) {
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}

function getStringMetadataValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export const stripePaymentAdapter: PaymentProviderAdapter = {
  provider: "stripe",

  async createPaymentSession(
    input: CreatePaymentSessionInput
  ): Promise<CreatePaymentSessionResult> {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: input.orderNo,
      customer_email: input.email,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      payment_method_types: getStripePaymentMethodTypes(),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: getStripeCurrency(),
            unit_amount: input.amountCents,
            product_data: {
              name: `极智岛 AI ${input.planName}`,
              description: `${input.points.toLocaleString(
                "zh-CN"
              )} 点 AI 使用点数`,
              metadata: {
                planId: input.planId,
              },
            },
          },
        },
      ],
      metadata: {
        orderNo: input.orderNo,
        planId: input.planId,
        planName: input.planName,
        points: String(input.points),
      },
      payment_intent_data: {
        metadata: {
          orderNo: input.orderNo,
          planId: input.planId,
          email: input.email,
        },
      },
    });

    if (!session.url) {
      throw new Error("Stripe Checkout Session URL was not returned");
    }

    return {
      provider: "stripe",
      providerOrderId: session.id,
      checkoutUrl: session.url,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : input.expiresAt,
    };
  },

  async verifyWebhook(
    input: VerifyPaymentWebhookInput
  ): Promise<VerifiedPaymentWebhook> {
    const stripe = getStripeClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    const signature = input.headers.get("stripe-signature");

    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    if (!signature) {
      throw new Error("Missing Stripe webhook signature");
    }

    const event = stripe.webhooks.constructEvent(
      input.rawBody,
      signature,
      webhookSecret
    );

    if (event.type !== "checkout.session.completed") {
      return {
        provider: "stripe",
        eventId: event.id,
        eventType: event.type,
        orderNo: "",
        providerOrderId: undefined,
        providerTransactionId: undefined,
        status: "unknown",
        paidAmountCents: 0,
        occurredAt: new Date(event.created * 1000).toISOString(),
        payloadDigest: digestPayload(input.rawBody),
      };
    }

    const session = event.data.object as Stripe.Checkout.Session;
    const orderNo =
      getStringMetadataValue(session.metadata?.orderNo) ||
      session.client_reference_id ||
      "";
    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;

    return {
      provider: "stripe",
      eventId: event.id,
      eventType: event.type,
      orderNo,
      providerOrderId: session.id,
      providerTransactionId: paymentIntent,
      status: session.payment_status === "paid" ? "paid" : "unknown",
      paidAmountCents: session.amount_total || 0,
      occurredAt: new Date(event.created * 1000).toISOString(),
      payloadDigest: digestPayload(input.rawBody),
    };
  },
};


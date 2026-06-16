export type PaymentProviderId =
  | "wechat"
  | "alipay"
  | "stripe"
  | "manual"
  | "sandbox";

export type PaymentProviderEventStatus =
  | "paid"
  | "refunded"
  | "closed"
  | "unknown";

export type CreatePaymentSessionInput = {
  orderNo: string;
  email: string;
  planId: string;
  planName: string;
  amountCents: number;
  points: number;
  expiresAt: string;
  successUrl: string;
  cancelUrl: string;
};

export type CreatePaymentSessionResult = {
  provider: PaymentProviderId;
  providerOrderId: string;
  checkoutUrl?: string;
  qrCodeUrl?: string;
  expiresAt?: string;
};

export type VerifyPaymentWebhookInput = {
  provider: PaymentProviderId;
  headers: Headers;
  rawBody: string;
};

export type VerifiedPaymentWebhook = {
  provider: PaymentProviderId;
  eventId: string;
  eventType: string;
  orderNo: string;
  providerOrderId?: string;
  providerTransactionId?: string;
  status: PaymentProviderEventStatus;
  paidAmountCents: number;
  occurredAt?: string;
  payloadDigest: string;
};

export type PaymentProviderAdapter = {
  provider: PaymentProviderId;
  createPaymentSession: (
    input: CreatePaymentSessionInput
  ) => Promise<CreatePaymentSessionResult>;
  verifyWebhook: (
    input: VerifyPaymentWebhookInput
  ) => Promise<VerifiedPaymentWebhook>;
};

export function isSuccessfulPaymentStatus(
  status: PaymentProviderEventStatus
) {
  return status === "paid";
}

export function validateWebhookAmount(
  expectedAmountCents: number,
  paidAmountCents: number
) {
  return (
    Number.isInteger(expectedAmountCents) &&
    Number.isInteger(paidAmountCents) &&
    expectedAmountCents > 0 &&
    paidAmountCents === expectedAmountCents
  );
}

import type { PaymentProviderId } from "@/lib/payments/contract";

export type PaymentRuntimeStatus = {
  mode: "manual" | "online";
  manualRechargeEnabled: boolean;
  onlinePaymentEnabled: boolean;
  requestedOnlinePayments: boolean;
  provider: PaymentProviderId;
  adapterImplemented: boolean;
  warnings: string[];
};

export const publicPaymentRuntimeStatusKeys = [
  "mode",
  "manualRechargeEnabled",
  "onlinePaymentEnabled",
  "requestedOnlinePayments",
  "provider",
  "adapterImplemented",
  "warnings",
] as const satisfies readonly (keyof PaymentRuntimeStatus)[];

const providerIds = new Set<PaymentProviderId>([
  "wechat",
  "alipay",
  "stripe",
  "manual",
  "sandbox",
]);

function normalizeProvider(value: string | undefined) {
  const provider = value?.trim().toLowerCase();

  if (!provider) return null;

  return providerIds.has(provider as PaymentProviderId)
    ? (provider as PaymentProviderId)
    : null;
}

function isStripeProviderConfigured() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_WEBHOOK_SECRET?.trim()
  );
}

export function getPaymentRuntimeStatus(): PaymentRuntimeStatus {
  const requestedOnlinePayments =
    process.env.ONLINE_PAYMENTS_ENABLED === "true";
  const rawProvider = process.env.PAYMENT_PROVIDER;
  const provider = normalizeProvider(rawProvider);
  const adapterImplemented = provider === "stripe";
  const providerConfigured = provider === "stripe" ? isStripeProviderConfigured() : false;
  const onlinePaymentEnabled =
    requestedOnlinePayments && adapterImplemented && providerConfigured;
  const warnings: string[] = [];

  if (rawProvider && !provider) {
    warnings.push("invalid_payment_provider");
  }

  if (requestedOnlinePayments && !adapterImplemented) {
    warnings.push("online_payments_requested_but_adapter_not_implemented");
  }

  if (requestedOnlinePayments && adapterImplemented && !providerConfigured) {
    warnings.push("online_payments_requested_but_provider_not_configured");
  }

  if (requestedOnlinePayments && !provider) {
    warnings.push("online_payments_requested_but_provider_not_configured");
  }

  return {
    mode: onlinePaymentEnabled ? "online" : "manual",
    manualRechargeEnabled: true,
    onlinePaymentEnabled,
    requestedOnlinePayments,
    provider: provider || "manual",
    adapterImplemented,
    warnings,
  };
}

export function toPublicPaymentRuntimeStatus(
  status: PaymentRuntimeStatus
): PaymentRuntimeStatus {
  return {
    mode: status.mode,
    manualRechargeEnabled: status.manualRechargeEnabled,
    onlinePaymentEnabled: status.onlinePaymentEnabled,
    requestedOnlinePayments: status.requestedOnlinePayments,
    provider: status.provider,
    adapterImplemented: status.adapterImplemented,
    warnings: [...status.warnings],
  };
}

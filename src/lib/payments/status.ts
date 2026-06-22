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

export function getPaymentRuntimeStatus(): PaymentRuntimeStatus {
  const requestedOnlinePayments =
    process.env.ONLINE_PAYMENTS_ENABLED === "true";
  const rawProvider = process.env.PAYMENT_PROVIDER;
  const provider = normalizeProvider(rawProvider);
  const adapterImplemented = false;
  const onlinePaymentEnabled =
    requestedOnlinePayments &&
    adapterImplemented &&
    provider !== null &&
    provider !== "manual" &&
    provider !== "sandbox";
  const warnings: string[] = [];

  if (rawProvider && !provider) {
    warnings.push("invalid_payment_provider");
  }

  if (requestedOnlinePayments && !adapterImplemented) {
    warnings.push("online_payments_requested_but_adapter_not_implemented");
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

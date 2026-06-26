import type { PaymentProviderAdapter, PaymentProviderId } from "@/lib/payments/contract";
import { alipayPaymentAdapter } from "@/lib/payments/alipay";
import { stripePaymentAdapter } from "@/lib/payments/stripe";
import { wechatPaymentAdapter } from "@/lib/payments/wechat";

const adapters: Partial<Record<PaymentProviderId, PaymentProviderAdapter>> = {
  alipay: alipayPaymentAdapter,
  stripe: stripePaymentAdapter,
  wechat: wechatPaymentAdapter,
};

export function getPaymentAdapter(provider: PaymentProviderId) {
  return adapters[provider] || null;
}

export function isPaymentAdapterImplemented(provider: PaymentProviderId | null) {
  return Boolean(provider && adapters[provider]);
}

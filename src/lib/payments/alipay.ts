import crypto from "node:crypto";
import type {
  CreatePaymentSessionInput,
  CreatePaymentSessionResult,
  PaymentProviderAdapter,
  VerifiedPaymentWebhook,
  VerifyPaymentWebhookInput,
} from "@/lib/payments/contract";

const ALIPAY_GATEWAY = "https://openapi.alipay.com/gateway.do";

function normalizePem(value: string, label: "PRIVATE KEY" | "PUBLIC KEY") {
  const normalized = value.replace(/\\n/g, "\n").trim();

  if (!normalized || normalized.includes("-----BEGIN")) return normalized;

  const body = normalized.match(/.{1,64}/g)?.join("\n") || normalized;
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
}

function getAlipayAppId() {
  return process.env.ALIPAY_APP_ID?.trim() || "";
}

function getAlipayPrivateKey() {
  return normalizePem(process.env.ALIPAY_PRIVATE_KEY || "", "PRIVATE KEY");
}

function getAlipayPublicKey() {
  return normalizePem(process.env.ALIPAY_PUBLIC_KEY || "", "PUBLIC KEY");
}

export function isAlipayConfigured() {
  return Boolean(getAlipayAppId() && getAlipayPrivateKey() && getAlipayPublicKey());
}

function getAlipayReturnUrl(fallback: string) {
  return process.env.ALIPAY_RETURN_URL?.trim() || fallback;
}

function getAlipayNotifyUrl() {
  const configured = process.env.ALIPAY_NOTIFY_URL?.trim();

  if (configured) return configured;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return siteUrl ? `${siteUrl}/api/payments/alipay/webhook` : "";
}

function signPayload(params: Record<string, string>) {
  const content = Object.keys(params)
    .filter((key) => params[key] !== "" && key !== "sign")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto
    .createSign("RSA-SHA256")
    .update(content, "utf8")
    .sign(getAlipayPrivateKey(), "base64");
}

function verifyAlipaySignature(params: Record<string, string>) {
  const sign = params.sign;
  const publicKey = getAlipayPublicKey();

  if (!sign || !publicKey) return false;

  const content = Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type" && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto
    .createVerify("RSA-SHA256")
    .update(content, "utf8")
    .verify(publicKey, sign, "base64");
}

function buildGatewayUrl(params: Record<string, string>) {
  const url = new URL(ALIPAY_GATEWAY);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

function digestPayload(rawBody: string) {
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}

function centsToYuan(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}

function yuanToCents(value: string | undefined) {
  if (!value) return 0;
  const normalized = Number.parseFloat(value);

  if (!Number.isFinite(normalized)) return 0;

  return Math.round(normalized * 100);
}

export const alipayPaymentAdapter: PaymentProviderAdapter = {
  provider: "alipay",

  async createPaymentSession(
    input: CreatePaymentSessionInput
  ): Promise<CreatePaymentSessionResult> {
    if (!isAlipayConfigured()) {
      throw new Error("Alipay is not configured");
    }

    const notifyUrl = getAlipayNotifyUrl();

    if (!notifyUrl) {
      throw new Error("ALIPAY_NOTIFY_URL or NEXT_PUBLIC_SITE_URL is not configured");
    }

    const bizContent = JSON.stringify({
      out_trade_no: input.orderNo,
      total_amount: centsToYuan(input.amountCents),
      subject: `极智岛 AI ${input.planName}`,
      product_code: "FAST_INSTANT_TRADE_PAY",
      passback_params: Buffer.from(
        JSON.stringify({ planId: input.planId, email: input.email }),
        "utf8"
      ).toString("base64url"),
    });

    const params: Record<string, string> = {
      app_id: getAlipayAppId(),
      method: "alipay.trade.page.pay",
      charset: "utf-8",
      sign_type: "RSA2",
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      version: "1.0",
      notify_url: notifyUrl,
      return_url: getAlipayReturnUrl(input.successUrl),
      biz_content: bizContent,
    };

    params.sign = signPayload(params);

    return {
      provider: "alipay",
      providerOrderId: input.orderNo,
      checkoutUrl: buildGatewayUrl(params),
      expiresAt: input.expiresAt,
    };
  },

  async verifyWebhook(
    input: VerifyPaymentWebhookInput
  ): Promise<VerifiedPaymentWebhook> {
    const params = Object.fromEntries(new URLSearchParams(input.rawBody));

    if (!verifyAlipaySignature(params)) {
      throw new Error("Invalid Alipay signature");
    }

    const tradeStatus = params.trade_status || "";
    const paid = tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED";

    return {
      provider: "alipay",
      eventId: params.notify_id || crypto.randomUUID(),
      eventType: tradeStatus || "alipay.notify",
      orderNo: params.out_trade_no || "",
      providerOrderId: params.out_trade_no || undefined,
      providerTransactionId: params.trade_no || undefined,
      status: paid ? "paid" : "unknown",
      paidAmountCents: yuanToCents(params.total_amount || params.buyer_pay_amount),
      occurredAt: params.gmt_payment || params.notify_time,
      payloadDigest: digestPayload(input.rawBody),
    };
  },
};


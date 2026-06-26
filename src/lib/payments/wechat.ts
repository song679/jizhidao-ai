import crypto from "node:crypto";
import type {
  CreatePaymentSessionInput,
  CreatePaymentSessionResult,
  PaymentProviderAdapter,
  VerifiedPaymentWebhook,
  VerifyPaymentWebhookInput,
} from "@/lib/payments/contract";

const WECHAT_NATIVE_URL = "https://api.mch.weixin.qq.com/v3/pay/transactions/native";

function normalizePem(value: string, label: "PRIVATE KEY" | "PUBLIC KEY") {
  const normalized = value.replace(/\\n/g, "\n").trim();

  if (!normalized || normalized.includes("-----BEGIN")) return normalized;

  const body = normalized.match(/.{1,64}/g)?.join("\n") || normalized;
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
}

function getWechatAppId() {
  return process.env.WECHAT_APP_ID?.trim() || "";
}

function getWechatMchId() {
  return process.env.WECHAT_MCH_ID?.trim() || "";
}

function getWechatSerialNo() {
  return process.env.WECHAT_MCH_SERIAL_NO?.trim() || "";
}

function getWechatPrivateKey() {
  return normalizePem(process.env.WECHAT_PRIVATE_KEY || "", "PRIVATE KEY");
}

function getWechatApiV3Key() {
  return process.env.WECHAT_API_V3_KEY?.trim() || "";
}

function getWechatPlatformPublicKey() {
  return normalizePem(process.env.WECHAT_PLATFORM_PUBLIC_KEY || "", "PUBLIC KEY");
}

export function isWechatConfigured() {
  return Boolean(
    getWechatAppId() &&
      getWechatMchId() &&
      getWechatSerialNo() &&
      getWechatPrivateKey() &&
      getWechatApiV3Key() &&
      getWechatPlatformPublicKey()
  );
}

function getWechatNotifyUrl() {
  const configured = process.env.WECHAT_NOTIFY_URL?.trim();

  if (configured) return configured;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return siteUrl ? `${siteUrl}/api/payments/wechat/webhook` : "";
}

function digestPayload(rawBody: string) {
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}

function signWechatMessage(message: string) {
  return crypto
    .createSign("RSA-SHA256")
    .update(message, "utf8")
    .sign(getWechatPrivateKey(), "base64");
}

function buildAuthorization(method: string, url: URL, body: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const message = `${method}\n${url.pathname}${url.search}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = signWechatMessage(message);

  return `WECHATPAY2-SHA256-RSA2048 mchid="${getWechatMchId()}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${getWechatSerialNo()}"`;
}

function decryptWechatResource(resource: {
  associated_data?: string;
  ciphertext: string;
  nonce: string;
}) {
  const apiV3Key = getWechatApiV3Key();
  const ciphertext = Buffer.from(resource.ciphertext, "base64");
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(apiV3Key, "utf8"),
    Buffer.from(resource.nonce, "utf8")
  );

  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
  }

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(decrypted) as {
    appid?: string;
    mchid?: string;
    out_trade_no?: string;
    transaction_id?: string;
    trade_state?: string;
    success_time?: string;
    amount?: { total?: number; payer_total?: number };
  };
}

function getWechatTimestamp(headers: Headers) {
  return headers.get("wechatpay-timestamp") || "";
}

function getWechatNonce(headers: Headers) {
  return headers.get("wechatpay-nonce") || "";
}

function verifyWechatSignature(headers: Headers, rawBody: string) {
  const timestamp = getWechatTimestamp(headers);
  const nonce = getWechatNonce(headers);
  const signature = headers.get("wechatpay-signature") || "";
  const publicKey = getWechatPlatformPublicKey();

  if (!timestamp || !nonce || !signature || !publicKey) return false;

  const message = `${timestamp}\n${nonce}\n${rawBody}\n`;

  return crypto
    .createVerify("RSA-SHA256")
    .update(message, "utf8")
    .verify(publicKey, signature, "base64");
}

export const wechatPaymentAdapter: PaymentProviderAdapter = {
  provider: "wechat",

  async createPaymentSession(
    input: CreatePaymentSessionInput
  ): Promise<CreatePaymentSessionResult> {
    if (!isWechatConfigured()) {
      throw new Error("WeChat Pay is not configured");
    }

    const notifyUrl = getWechatNotifyUrl();

    if (!notifyUrl) {
      throw new Error("WECHAT_NOTIFY_URL or NEXT_PUBLIC_SITE_URL is not configured");
    }

    const body = JSON.stringify({
      appid: getWechatAppId(),
      mchid: getWechatMchId(),
      description: `极智岛 AI ${input.planName}`,
      out_trade_no: input.orderNo,
      notify_url: notifyUrl,
      amount: {
        total: input.amountCents,
        currency: "CNY",
      },
      attach: JSON.stringify({ planId: input.planId, email: input.email }),
    });
    const url = new URL(WECHAT_NATIVE_URL);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: buildAuthorization("POST", url, body),
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "jizhidao-ai/1.0",
      },
      body,
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || typeof data.code_url !== "string") {
      throw new Error(data?.message || "WeChat Pay native order failed");
    }

    const codeUrl = data.code_url as string;
    const checkoutUrl = `/pay/wechat?order=${encodeURIComponent(
      input.orderNo
    )}&code=${encodeURIComponent(codeUrl)}`;

    return {
      provider: "wechat",
      providerOrderId: input.orderNo,
      checkoutUrl,
      qrCodeUrl: codeUrl,
      expiresAt: input.expiresAt,
    };
  },

  async verifyWebhook(
    input: VerifyPaymentWebhookInput
  ): Promise<VerifiedPaymentWebhook> {
    if (!verifyWechatSignature(input.headers, input.rawBody)) {
      throw new Error("Invalid WeChat Pay webhook signature");
    }

    const timestamp = getWechatTimestamp(input.headers);
    const nonce = getWechatNonce(input.headers);
    const body = JSON.parse(input.rawBody) as {
      id?: string;
      event_type?: string;
      create_time?: string;
      resource?: {
        associated_data?: string;
        ciphertext: string;
        nonce: string;
      };
    };

    if (!timestamp || !nonce || !body.resource) {
      throw new Error("Invalid WeChat Pay webhook payload");
    }

    const transaction = decryptWechatResource(body.resource);
    const paid = transaction.trade_state === "SUCCESS";

    return {
      provider: "wechat",
      eventId: body.id || crypto.randomUUID(),
      eventType: body.event_type || transaction.trade_state || "wechat.notify",
      orderNo: transaction.out_trade_no || "",
      providerOrderId: transaction.out_trade_no || undefined,
      providerTransactionId: transaction.transaction_id,
      status: paid ? "paid" : "unknown",
      paidAmountCents: transaction.amount?.payer_total || transaction.amount?.total || 0,
      occurredAt: transaction.success_time || body.create_time,
      payloadDigest: digestPayload(input.rawBody),
    };
  },
};


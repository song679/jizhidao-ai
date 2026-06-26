import { NextResponse } from "next/server";
import { wechatPaymentAdapter } from "@/lib/payments/wechat";
import { completeRechargeFromPaymentEvent } from "@/lib/payments/complete";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    const event = await wechatPaymentAdapter.verifyWebhook({
      provider: "wechat",
      headers: request.headers,
      rawBody,
    });
    const result = await completeRechargeFromPaymentEvent(event);

    return NextResponse.json({ code: "SUCCESS", message: "成功", result });
  } catch (error) {
    console.error("WeChat Pay webhook processing failed:", error);

    return NextResponse.json(
      { code: "FAIL", message: "微信支付通知处理失败" },
      { status: 400 }
    );
  }
}

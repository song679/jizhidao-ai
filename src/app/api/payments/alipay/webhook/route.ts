import { NextResponse } from "next/server";
import { alipayPaymentAdapter } from "@/lib/payments/alipay";
import { completeRechargeFromPaymentEvent } from "@/lib/payments/complete";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    const event = await alipayPaymentAdapter.verifyWebhook({
      provider: "alipay",
      headers: request.headers,
      rawBody,
    });
    await completeRechargeFromPaymentEvent(event);

    return new Response("success", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Alipay webhook processing failed:", error);

    return NextResponse.json(
      { error: "Alipay webhook processing failed" },
      { status: 400 }
    );
  }
}

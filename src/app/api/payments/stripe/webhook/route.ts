import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyOrderPaid } from "@/lib/order-notifications";
import { isSuccessfulPaymentStatus } from "@/lib/payments/contract";
import { stripePaymentAdapter } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

type PaidOrderRow = {
  order_no: string;
  email: string;
  plan_name: string;
  amount_cents: number;
  points: number;
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Supabase admin client is not configured");
  }

  return createClient(supabaseUrl, supabaseSecretKey);
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  let event;

  try {
    event = await stripePaymentAdapter.verifyWebhook({
      provider: "stripe",
      headers: request.headers,
      rawBody,
    });
  } catch (error) {
    console.error("Stripe webhook verification failed:", error);

    return NextResponse.json(
      { error: "Invalid Stripe webhook signature" },
      { status: 400 }
    );
  }

  if (!isSuccessfulPaymentStatus(event.status)) {
    return NextResponse.json({ received: true, ignored: event.eventType });
  }

  if (!event.orderNo) {
    return NextResponse.json(
      { error: "Stripe webhook missing order number" },
      { status: 400 }
    );
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: result, error } = await supabaseAdmin.rpc(
      "complete_online_recharge_order",
      {
        p_order_no: event.orderNo,
        p_provider: event.provider,
        p_provider_order_id: event.providerOrderId || null,
        p_provider_transaction_id: event.providerTransactionId || null,
        p_amount_cents: event.paidAmountCents,
        p_event_id: event.eventId,
        p_event_type: event.eventType,
        p_payload_digest: event.payloadDigest,
        p_payment_metadata: {
          occurredAt: event.occurredAt,
          source: "stripe_checkout",
        },
      }
    );

    if (error) {
      console.error("Complete online recharge order failed:", error);

      return NextResponse.json(
        { error: "Complete online recharge order failed" },
        { status: 500 }
      );
    }

    if (result?.status === "paid") {
      const { data: order } = await supabaseAdmin
        .from("recharge_orders")
        .select("order_no, email, plan_name, amount_cents, points")
        .eq("order_no", event.orderNo)
        .maybeSingle<PaidOrderRow>();

      if (order) {
        await notifyOrderPaid({
          orderNo: order.order_no,
          email: order.email,
          planName: order.plan_name,
          amountCents: order.amount_cents,
          points: order.points,
        });
      }
    }

    return NextResponse.json({ received: true, result });
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);

    return NextResponse.json(
      { error: "Stripe webhook processing failed" },
      { status: 500 }
    );
  }
}

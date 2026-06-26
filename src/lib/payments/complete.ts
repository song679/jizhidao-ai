import { createClient } from "@supabase/supabase-js";
import { notifyOrderPaid } from "@/lib/order-notifications";
import type { VerifiedPaymentWebhook } from "@/lib/payments/contract";
import { isSuccessfulPaymentStatus } from "@/lib/payments/contract";

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

export async function completeRechargeFromPaymentEvent(
  event: VerifiedPaymentWebhook
) {
  if (!isSuccessfulPaymentStatus(event.status)) {
    return { received: true, ignored: event.eventType };
  }

  if (!event.orderNo) {
    throw new Error("Payment webhook missing order number");
  }

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
        source: `${event.provider}_webhook`,
      },
    }
  );

  if (error) {
    throw new Error(`Complete online recharge order failed: ${error.message}`);
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

  return { received: true, result };
}

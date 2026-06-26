import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyOrderCreated } from "@/lib/order-notifications";
import { getRechargePlan } from "@/lib/recharge-plans";
import { getPaymentRuntimeStatus } from "@/lib/payments/status";
import { stripePaymentAdapter } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

function getOrderNumber() {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `JZD${timestamp}${random}`;
}

function getSiteUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  return new URL(request.url).origin;
}

async function getUserContext(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseSecretKey) {
    return {
      error: NextResponse.json(
        { error: "服务器未配置完整的支付服务" },
        { status: 500 }
      ),
      user: null,
      supabaseAdmin: null,
    };
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { error: "请先登录后再发起在线支付" },
        { status: 401 }
      ),
      user: null,
      supabaseAdmin: null,
    };
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser(authorization.slice("Bearer ".length));

  if (userError || !user?.email) {
    return {
      error: NextResponse.json(
        { error: "登录状态无效，请重新登录" },
        { status: 401 }
      ),
      user: null,
      supabaseAdmin: null,
    };
  }

  return {
    error: null,
    user,
    supabaseAdmin: createClient(supabaseUrl, supabaseSecretKey),
  };
}

const ORDER_EXPIRY_HOURS = Math.min(
  168,
  Math.max(
    1,
    Number.parseInt(process.env.ORDER_EXPIRY_HOURS || "24", 10) || 24
  )
);

function getOrderExpiryCutoff() {
  return new Date(
    Date.now() - ORDER_EXPIRY_HOURS * 60 * 60 * 1000
  ).toISOString();
}

function withOrderExpiry<T extends { created_at: string }>(order: T) {
  return {
    ...order,
    expires_at: new Date(
      new Date(order.created_at).getTime() +
        ORDER_EXPIRY_HOURS * 60 * 60 * 1000
    ).toISOString(),
  };
}

function isMissingOrdersTable(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

export async function POST(request: Request) {
  const paymentStatus = getPaymentRuntimeStatus();

  if (!paymentStatus.onlinePaymentEnabled || paymentStatus.provider !== "stripe") {
    return NextResponse.json(
      {
        error: "在线支付暂未开启，请先使用手动充值或联系管理员",
        paymentStatus,
      },
      { status: 503 }
    );
  }

  const context = await getUserContext(request);

  if (context.error || !context.user || !context.supabaseAdmin) {
    return context.error;
  }

  const body = await request.json().catch(() => ({}));
  const plan = getRechargePlan(body?.planId);

  if (!plan) {
    return NextResponse.json(
      { error: "请选择有效的充值套餐" },
      { status: 400 }
    );
  }

  const userEmail = context.user.email;

  if (!userEmail) {
    return NextResponse.json(
      { error: "登录状态无效，请重新登录" },
      { status: 401 }
    );
  }

  const normalizedUserEmail = userEmail.toLowerCase();

  const { error: expireError } = await context.supabaseAdmin
    .from("recharge_orders")
    .update({
      status: "cancelled",
      note: "订单超过有效期，系统自动关闭",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", context.user.id)
    .eq("status", "pending")
    .lt("created_at", getOrderExpiryCutoff());

  if (isMissingOrdersTable(expireError)) {
    return NextResponse.json(
      { error: "订单服务正在初始化，请稍后再试", ready: false },
      { status: 503 }
    );
  }

  if (expireError) {
    return NextResponse.json(
      { error: "更新历史订单状态失败，请稍后重试" },
      { status: 500 }
    );
  }

  const { data: existingOrder, error: existingOrderError } =
    await context.supabaseAdmin
      .from("recharge_orders")
      .select(
        "id, order_no, plan_id, plan_name, amount_cents, points, status, created_at, provider_order_id"
      )
      .eq("user_id", context.user.id)
      .eq("plan_id", plan.id)
      .eq("status", "pending")
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 60 * 1000).toISOString()
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (isMissingOrdersTable(existingOrderError)) {
    return NextResponse.json(
      { error: "订单服务正在初始化，请稍后再试", ready: false },
      { status: 503 }
    );
  }

  if (existingOrderError) {
    return NextResponse.json(
      { error: "检查待支付订单失败" },
      { status: 500 }
    );
  }

  let order = existingOrder;
  let reused = Boolean(existingOrder);

  if (!order) {
    const { data: createdOrder, error: insertError } =
      await context.supabaseAdmin
        .from("recharge_orders")
        .insert({
          order_no: getOrderNumber(),
          user_id: context.user.id,
          email: normalizedUserEmail,
          plan_id: plan.id,
          plan_name: plan.name,
          amount_cents: plan.priceCents,
          points: plan.points,
          status: "pending",
          payment_provider: "stripe",
        })
        .select(
          "id, order_no, plan_id, plan_name, amount_cents, points, status, created_at, provider_order_id"
        )
        .single();

    if (isMissingOrdersTable(insertError)) {
      return NextResponse.json(
        { error: "订单服务正在初始化，请稍后再试", ready: false },
        { status: 503 }
      );
    }

    if (insertError || !createdOrder) {
      return NextResponse.json(
        { error: "创建充值订单失败，请稍后重试" },
        { status: 500 }
      );
    }

    order = createdOrder;
    reused = false;

    await notifyOrderCreated({
      orderNo: order.order_no,
      email: normalizedUserEmail,
      planName: order.plan_name,
      amountCents: order.amount_cents,
      points: order.points,
    });
  }

  const siteUrl = getSiteUrl(request);
  const paymentSession = await stripePaymentAdapter.createPaymentSession({
    orderNo: order.order_no,
    email: normalizedUserEmail,
    planId: order.plan_id,
    planName: order.plan_name,
    amountCents: order.amount_cents,
    points: order.points,
    expiresAt: withOrderExpiry(order).expires_at,
    successUrl: `${siteUrl}/orders?checkout=success&order=${encodeURIComponent(
      order.order_no
    )}`,
    cancelUrl: `${siteUrl}/pricing?checkout=cancelled&order=${encodeURIComponent(
      order.order_no
    )}`,
  });

  const { error: updateError } = await context.supabaseAdmin
    .from("recharge_orders")
    .update({
      payment_channel: "stripe",
      payment_provider: "stripe",
      provider_order_id: paymentSession.providerOrderId,
      payment_created_at: new Date().toISOString(),
      payment_metadata: {
        checkoutUrl: paymentSession.checkoutUrl,
        stripeCurrency: process.env.STRIPE_CURRENCY || "cny",
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("status", "pending");

  if (updateError) {
    return NextResponse.json(
      { error: "保存支付订单信息失败，请稍后重试" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    order: withOrderExpiry(order),
    payment: paymentSession,
    checkoutUrl: paymentSession.checkoutUrl,
    reused,
  });
}


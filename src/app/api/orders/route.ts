import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyOrderCreated } from "@/lib/order-notifications";
import { getRechargePlan } from "@/lib/recharge-plans";

function getOrderNumber() {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `JZD${timestamp}${random}`;
}

async function getUserContext(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseSecretKey) {
    return {
      error: NextResponse.json(
        { error: "服务器未配置完整的订单服务" },
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
        { error: "请先登录后再创建充值订单" },
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
  } = await supabaseAuth.auth.getUser(
    authorization.slice("Bearer ".length)
  );

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

function isMissingOrdersTable(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
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

async function expireUserOrders(
  supabaseAdmin: NonNullable<
    Awaited<ReturnType<typeof getUserContext>>["supabaseAdmin"]
  >,
  userId: string
) {
  return supabaseAdmin
    .from("recharge_orders")
    .update({
      status: "cancelled",
      note: "订单超过有效期，系统自动关闭",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("status", "pending")
    .lt("created_at", getOrderExpiryCutoff());
}

export async function GET(request: Request) {
  const context = await getUserContext(request);

  if (context.error || !context.user || !context.supabaseAdmin) {
    return context.error;
  }

  const { error: expireError } = await expireUserOrders(
    context.supabaseAdmin,
    context.user.id
  );

  if (expireError && !isMissingOrdersTable(expireError)) {
    return NextResponse.json(
      { error: "更新订单状态失败，请稍后重试" },
      { status: 500 }
    );
  }

  const { data: orders, error } = await context.supabaseAdmin
    .from("recharge_orders")
    .select(
      "id, order_no, plan_id, plan_name, amount_cents, points, status, payment_channel, payment_reference, note, created_at, paid_at, updated_at"
    )
    .eq("user_id", context.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (isMissingOrdersTable(error)) {
    return NextResponse.json({
      ready: false,
      orders: [],
    });
  }

  if (error) {
    return NextResponse.json(
      { error: "查询充值订单失败" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ready: true,
    orders: (orders || []).map(withOrderExpiry),
  });
}

export async function POST(request: Request) {
  const context = await getUserContext(request);

  if (context.error || !context.user || !context.supabaseAdmin) {
    return context.error;
  }

  const userEmail = context.user.email;

  if (!userEmail) {
    return NextResponse.json(
      { error: "当前账号缺少有效邮箱" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const plan = getRechargePlan(body?.planId);

  if (!plan) {
    return NextResponse.json(
      { error: "请选择有效的充值套餐" },
      { status: 400 }
    );
  }

  const { error: expireError } = await expireUserOrders(
    context.supabaseAdmin,
    context.user.id
  );

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
        "id, order_no, plan_id, plan_name, amount_cents, points, status, created_at"
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

  if (existingOrder) {
    return NextResponse.json({
      order: withOrderExpiry(existingOrder),
      reused: true,
    });
  }

  const { data: order, error: insertError } = await context.supabaseAdmin
    .from("recharge_orders")
    .insert({
      order_no: getOrderNumber(),
      user_id: context.user.id,
      email: userEmail.toLowerCase(),
      plan_id: plan.id,
      plan_name: plan.name,
      amount_cents: plan.priceCents,
      points: plan.points,
      status: "pending",
    })
    .select(
      "id, order_no, plan_id, plan_name, amount_cents, points, status, created_at"
    )
    .single();

  if (isMissingOrdersTable(insertError)) {
    return NextResponse.json(
      { error: "订单服务正在初始化，请稍后再试", ready: false },
      { status: 503 }
    );
  }

  if (insertError || !order) {
    return NextResponse.json(
      { error: "创建充值订单失败，请稍后重试" },
      { status: 500 }
    );
  }

  await notifyOrderCreated({
    orderNo: order.order_no,
    email: userEmail.toLowerCase(),
    planName: order.plan_name,
    amountCents: order.amount_cents,
    points: order.points,
  });

  return NextResponse.json(
    { order: withOrderExpiry(order) },
    { status: 201 }
  );
}

export async function PATCH(request: Request) {
  const context = await getUserContext(request);

  if (context.error || !context.user || !context.supabaseAdmin) {
    return context.error;
  }

  const body = await request.json().catch(() => ({}));
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  const action = body?.action;

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      orderId
    )
  ) {
    return NextResponse.json({ error: "订单标识无效" }, { status: 400 });
  }

  if (action !== "cancel") {
    return NextResponse.json(
      { error: "不支持的订单操作" },
      { status: 400 }
    );
  }

  const { data: order, error } = await context.supabaseAdmin
    .from("recharge_orders")
    .update({
      status: "cancelled",
      note: "用户主动取消订单",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("user_id", context.user.id)
    .eq("status", "pending")
    .select(
      "id, order_no, plan_id, plan_name, amount_cents, points, status, payment_channel, payment_reference, note, created_at, paid_at, updated_at"
    )
    .maybeSingle();

  if (isMissingOrdersTable(error)) {
    return NextResponse.json(
      { error: "订单服务正在初始化，请稍后再试", ready: false },
      { status: 503 }
    );
  }

  if (error) {
    return NextResponse.json(
      { error: "取消订单失败，请稍后重试" },
      { status: 500 }
    );
  }

  if (!order) {
    return NextResponse.json(
      { error: "订单不存在、已处理或不属于当前账号" },
      { status: 409 }
    );
  }

  return NextResponse.json({ order: withOrderExpiry(order) });
}

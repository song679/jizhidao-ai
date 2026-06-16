import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";
import {
  notifyOrderCancelled,
  notifyOrderPaid,
} from "@/lib/order-notifications";

export const dynamic = "force-dynamic";

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

const paymentChannels = new Set(["manual", "wechat", "alipay", "bank"]);
const orderStatuses = new Set(["pending", "paid", "cancelled", "refunded"]);
const orderFields =
  "id, order_no, email, plan_name, amount_cents, points, status, payment_channel, payment_reference, admin_email, note, created_at, paid_at, updated_at";
const ORDER_EXPIRY_HOURS = Math.min(
  168,
  Math.max(
    1,
    Number.parseInt(process.env.ORDER_EXPIRY_HOURS || "24", 10) || 24
  )
);

type RechargeOrderRow = {
  id: string;
  order_no: string;
  email: string;
  plan_name: string;
  amount_cents: number;
  points: number;
  status: string;
  payment_channel: string | null;
  payment_reference: string | null;
  admin_email: string | null;
  note: string | null;
  created_at: string;
  paid_at: string | null;
  updated_at: string;
};

function sanitizeSearch(value: string | null) {
  return (value || "")
    .trim()
    .slice(0, 100)
    .replace(/[^\p{L}\p{N}@._+-]/gu, "");
}

function escapeCsvCell(value: unknown) {
  const text =
    value === null || typeof value === "undefined" ? "" : String(value);
  const injectionSafeText = /^[=+\-@\t\r]/.test(text) ? `\t${text}` : text;

  return `"${injectionSafeText.replace(/"/g, '""')}"`;
}

function buildOrdersCsv(orders: RechargeOrderRow[]) {
  const headers = [
    "order_no",
    "email",
    "plan_name",
    "amount_yuan",
    "amount_cents",
    "points",
    "status",
    "payment_channel",
    "payment_reference",
    "admin_email",
    "note",
    "created_at",
    "paid_at",
    "updated_at",
  ];
  const rows = orders.map((order) => [
    order.order_no,
    order.email,
    order.plan_name,
    (order.amount_cents / 100).toFixed(2),
    order.amount_cents,
    order.points,
    order.status,
    order.payment_channel,
    order.payment_reference,
    order.admin_email,
    order.note,
    order.created_at,
    order.paid_at,
    order.updated_at,
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");
}

function getOrderExpiryCutoff() {
  return new Date(
    Date.now() - ORDER_EXPIRY_HOURS * 60 * 60 * 1000
  ).toISOString();
}

async function expirePendingOrders(
  supabaseAdmin: NonNullable<
    Awaited<ReturnType<typeof authorizeAdmin>>["supabaseAdmin"]
  >
) {
  return supabaseAdmin
    .from("recharge_orders")
    .update({
      status: "cancelled",
      note: "订单超过有效期，系统自动关闭",
      updated_at: new Date().toISOString(),
    })
    .eq("status", "pending")
    .lt("created_at", getOrderExpiryCutoff());
}

export async function GET(request: Request) {
  const context = await authorizeAdmin(request);

  if (context.error) {
    return context.error;
  }

  const { error: expireError } = await expirePendingOrders(
    context.supabaseAdmin
  );

  if (
    expireError &&
    expireError.code !== "42P01" &&
    expireError.code !== "PGRST205"
  ) {
    return NextResponse.json(
      { error: "更新过期订单失败，请稍后重试" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";
  const format = searchParams.get("format") || "json";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(
      10,
      Number.parseInt(searchParams.get("pageSize") || "20", 10) || 20
    )
  );
  const search = sanitizeSearch(searchParams.get("search"));
  const rangeStart = (page - 1) * pageSize;
  const rangeEnd = rangeStart + pageSize - 1;

  if (format === "csv") {
    let exportQuery = context.supabaseAdmin
      .from("recharge_orders")
      .select(orderFields)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (orderStatuses.has(status)) {
      exportQuery = exportQuery.eq("status", status);
    }

    if (search) {
      exportQuery = exportQuery.or(
        `order_no.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data: orders, error } = await exportQuery;

    if (error?.code === "42P01" || error?.code === "PGRST205") {
      return NextResponse.json(
        { error: "Recharge orders database is not initialized" },
        { status: 503 }
      );
    }

    if (error) {
      return NextResponse.json(
        { error: "Export recharge orders failed" },
        { status: 500 }
      );
    }

    const csv = buildOrdersCsv((orders || []) as RechargeOrderRow[]);
    const filename = `recharge-orders-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  let query = context.supabaseAdmin
    .from("recharge_orders")
    .select(orderFields, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(rangeStart, rangeEnd);

  if (orderStatuses.has(status)) {
    query = query.eq("status", status);
  }

  if (search) {
    query = query.or(
      `order_no.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const { data: orders, error, count } = await query;

  if (error?.code === "42P01" || error?.code === "PGRST205") {
    return NextResponse.json({
      ready: false,
      adminEmail: context.adminEmail,
      orders: [],
      total: 0,
      page,
      pageSize,
    });
  }

  if (error) {
    const permissionDenied = error.code === "42501";

    return NextResponse.json(
      {
        error: permissionDenied
          ? "订单表权限尚未配置，请执行订单权限迁移"
          : "加载充值订单失败，请稍后重试",
        errorCode: permissionDenied
          ? "ORDERS_PERMISSION_DENIED"
          : "ORDERS_QUERY_FAILED",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ready: true,
    adminEmail: context.adminEmail,
    orders: orders || [],
    total: count || 0,
    page,
    pageSize,
  });
}

export async function PATCH(request: Request) {
  const context = await authorizeAdmin(request);

  if (context.error) {
    return context.error;
  }

  const body = await request.json().catch(() => ({}));
  const orderId = body?.orderId;
  const action = body?.action;
  const note =
    typeof body?.note === "string" ? body.note.trim().slice(0, 200) : "";

  if (!isUuid(orderId)) {
    return NextResponse.json(
      { error: "订单标识无效" },
      { status: 400 }
    );
  }

  if (action === "cancel") {
    const { data: order, error } = await context.supabaseAdmin
      .from("recharge_orders")
      .update({
        status: "cancelled",
        admin_email: context.adminEmail,
        note: note || "管理员取消订单",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("status", "pending")
      .select(
        "id, order_no, email, plan_name, amount_cents, points, status"
      )
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "取消订单失败" },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: "订单不存在或状态已经变化" },
        { status: 409 }
      );
    }

    await notifyOrderCancelled(
      {
        orderNo: order.order_no,
        email: order.email,
        planName: order.plan_name,
        amountCents: order.amount_cents,
        points: order.points,
      },
      note || "管理员取消订单"
    );

    return NextResponse.json({ order });
  }

  if (action !== "complete") {
    return NextResponse.json(
      { error: "不支持的订单操作" },
      { status: 400 }
    );
  }

  const { data: pendingOrder, error: pendingOrderError } =
    await context.supabaseAdmin
      .from("recharge_orders")
      .select(
        "id, order_no, email, plan_name, amount_cents, points, created_at, status"
      )
      .eq("id", orderId)
      .maybeSingle();

  if (pendingOrderError) {
    return NextResponse.json(
      { error: "检查订单状态失败" },
      { status: 500 }
    );
  }

  if (!pendingOrder) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }

  if (
    pendingOrder.status === "pending" &&
    pendingOrder.created_at < getOrderExpiryCutoff()
  ) {
    await context.supabaseAdmin
      .from("recharge_orders")
      .update({
        status: "cancelled",
        admin_email: context.adminEmail,
        note: "订单超过有效期，系统自动关闭",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("status", "pending");

    return NextResponse.json(
      { error: "订单已超过有效期，不能确认到账" },
      { status: 409 }
    );
  }

  const paymentChannel =
    typeof body?.paymentChannel === "string"
      ? body.paymentChannel.trim().slice(0, 30)
      : "manual";
  const paymentReference =
    typeof body?.paymentReference === "string"
      ? body.paymentReference.trim().slice(0, 100)
      : "";
  const { data: result, error } = await context.supabaseAdmin.rpc(
    "complete_recharge_order",
    {
      p_order_id: orderId,
      p_admin_email: context.adminEmail,
      p_payment_channel: paymentChannels.has(paymentChannel)
        ? paymentChannel
        : "manual",
      p_payment_reference: paymentReference || null,
      p_note: note || null,
    }
  );

  if (error?.code === "PGRST202") {
    return NextResponse.json(
      { error: "订单数据库函数尚未安装，请先执行订单迁移 SQL" },
      { status: 503 }
    );
  }

  if (error) {
    return NextResponse.json(
      { error: "确认订单到账失败" },
      { status: 500 }
    );
  }

  if (result?.status !== "paid") {
    return NextResponse.json(
      {
        error:
          result?.status === "not_found"
            ? "订单不存在"
            : "订单已经处理，请刷新后查看",
      },
      { status: result?.status === "not_found" ? 404 : 409 }
    );
  }

  await notifyOrderPaid({
    orderNo: result.orderNo,
    email: result.email,
    planName: pendingOrder.plan_name,
    amountCents: pendingOrder.amount_cents,
    points: result.pointsAdded,
  });

  return NextResponse.json({ result });
}

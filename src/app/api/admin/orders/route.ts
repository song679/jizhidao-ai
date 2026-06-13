import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

export async function GET(request: Request) {
  const context = await authorizeAdmin(request);

  if (context.error) {
    return context.error;
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(
      10,
      Number.parseInt(searchParams.get("pageSize") || "20", 10) || 20
    )
  );
  const search = (searchParams.get("search") || "")
    .trim()
    .slice(0, 100)
    .replace(/[^\p{L}\p{N}@._+-]/gu, "");
  const rangeStart = (page - 1) * pageSize;
  const rangeEnd = rangeStart + pageSize - 1;
  let query = context.supabaseAdmin
    .from("recharge_orders")
    .select(
      "id, order_no, email, plan_name, amount_cents, points, status, payment_channel, payment_reference, admin_email, note, created_at, paid_at, updated_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(rangeStart, rangeEnd);

  if (["pending", "paid", "cancelled", "refunded"].includes(status)) {
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
      .select("id, order_no, status")
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

    return NextResponse.json({ order });
  }

  if (action !== "complete") {
    return NextResponse.json(
      { error: "不支持的订单操作" },
      { status: 400 }
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
      p_payment_channel: paymentChannel || "manual",
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

  return NextResponse.json({ result });
}

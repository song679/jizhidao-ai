import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";

type CheckStatus = "ok" | "warning" | "error";

type SystemCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
};

const requiredEnvironmentVariables = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "ADMIN_EMAILS",
] as const;

const optionalEnvironmentVariables = [
  "OPENAI_API_KEY",
  "DEEPSEEK_API_KEY",
  "NEXT_PUBLIC_ADMIN_EMAIL",
  "NEXT_PUBLIC_ADMIN_WECHAT",
] as const;

const requiredTables = [
  ["user_points", "用户点数"],
  ["point_transactions", "点数流水"],
  ["chat_sessions", "聊天会话"],
  ["chat_messages", "聊天消息"],
  ["chat_request_ledger", "聊天计费账本"],
  ["recharge_orders", "充值订单"],
] as const;

const ORDER_EXPIRY_HOURS = Math.min(
  168,
  Math.max(
    1,
    Number.parseInt(process.env.ORDER_EXPIRY_HOURS || "24", 10) || 24
  )
);

export async function GET(request: Request) {
  const context = await authorizeAdmin(request);

  if (context.error) {
    return context.error;
  }

  const environment = [
    ...requiredEnvironmentVariables.map((name) => ({
      name,
      configured: Boolean(process.env[name]),
      required: true,
    })),
    ...optionalEnvironmentVariables.map((name) => ({
      name,
      configured: Boolean(process.env[name]),
      required: false,
    })),
  ];

  const tableResults = await Promise.all(
    requiredTables.map(async ([table, label]) => {
      const startedAt = Date.now();
      const { error } = await context.supabaseAdmin
        .from(table)
        .select("*", { count: "exact", head: true });

      return {
        id: `table:${table}`,
        label,
        status: error ? ("error" as const) : ("ok" as const),
        detail: error
          ? "不可用，请检查数据库迁移和 service_role 权限"
          : `可用，响应 ${Date.now() - startedAt}ms`,
      };
    })
  );

  const { error: orderFunctionError } = await context.supabaseAdmin.rpc(
    "complete_recharge_order",
    {
      p_order_id: "00000000-0000-4000-8000-000000000000",
      p_admin_email: context.adminEmail,
      p_payment_channel: "diagnostic",
      p_payment_reference: null,
      p_note: null,
    }
  );
  const orderFunctionMissing =
    orderFunctionError?.code === "PGRST202" ||
    orderFunctionError?.code === "42883";
  const checks: SystemCheck[] = [
    ...tableResults,
    {
      id: "function:complete_recharge_order",
      label: "订单原子充值函数",
      status: orderFunctionMissing ? "error" : "ok",
      detail: orderFunctionMissing
        ? "未安装，请执行充值订单迁移"
        : "已安装",
    },
  ];
  const staleReservationCutoff = new Date(
    Date.now() - 10 * 60 * 1000
  ).toISOString();
  const expiredOrderCutoff = new Date(
    Date.now() - ORDER_EXPIRY_HOURS * 60 * 60 * 1000
  ).toISOString();
  const [
    negativeBalancesResult,
    staleReservationsResult,
    expiredOrdersResult,
    incompletePaidOrdersResult,
  ] = await Promise.all([
    context.supabaseAdmin
      .from("user_points")
      .select("id", { count: "exact", head: true })
      .lt("points", 0),
    context.supabaseAdmin
      .from("chat_request_ledger")
      .select("request_id", { count: "exact", head: true })
      .eq("status", "reserved")
      .lt("created_at", staleReservationCutoff),
    context.supabaseAdmin
      .from("recharge_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", expiredOrderCutoff),
    context.supabaseAdmin
      .from("recharge_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "paid")
      .is("paid_at", null),
  ]);
  const integrityChecks: SystemCheck[] = [
    {
      id: "integrity:negative-balances",
      label: "用户负数余额",
      status: negativeBalancesResult.error
        ? "error"
        : (negativeBalancesResult.count || 0) > 0
          ? "warning"
          : "ok",
      detail: negativeBalancesResult.error
        ? "检查失败"
        : (negativeBalancesResult.count || 0) > 0
          ? `发现 ${negativeBalancesResult.count} 个负数余额账户`
          : "未发现负数余额",
    },
    {
      id: "integrity:stale-reservations",
      label: "滞留扣点请求",
      status: staleReservationsResult.error
        ? "error"
        : (staleReservationsResult.count || 0) > 0
          ? "warning"
          : "ok",
      detail: staleReservationsResult.error
        ? "检查失败"
        : (staleReservationsResult.count || 0) > 0
          ? `发现 ${staleReservationsResult.count} 个超过 10 分钟的预扣请求`
          : "未发现滞留预扣",
    },
    {
      id: "integrity:expired-orders",
      label: "过期未关闭订单",
      status: expiredOrdersResult.error
        ? "error"
        : (expiredOrdersResult.count || 0) > 0
          ? "warning"
          : "ok",
      detail: expiredOrdersResult.error
        ? "检查失败"
        : (expiredOrdersResult.count || 0) > 0
          ? `发现 ${expiredOrdersResult.count} 个超过 ${ORDER_EXPIRY_HOURS} 小时的待确认订单`
          : "未发现过期未关闭订单",
    },
    {
      id: "integrity:paid-without-time",
      label: "到账订单完整性",
      status: incompletePaidOrdersResult.error
        ? "error"
        : (incompletePaidOrdersResult.count || 0) > 0
          ? "warning"
          : "ok",
      detail: incompletePaidOrdersResult.error
        ? "检查失败"
        : (incompletePaidOrdersResult.count || 0) > 0
          ? `发现 ${incompletePaidOrdersResult.count} 个缺少到账时间的已支付订单`
          : "已支付订单记录完整",
    },
  ];
  const missingRequiredEnvironment = environment.filter(
    (item) => item.required && !item.configured
  );
  const failedChecks = checks.filter((item) => item.status === "error");
  const failedIntegrityChecks = integrityChecks.filter(
    (item) => item.status === "error"
  );
  const warningIntegrityChecks = integrityChecks.filter(
    (item) => item.status === "warning"
  );
  const overallStatus: CheckStatus =
    missingRequiredEnvironment.length > 0 ||
    failedChecks.length > 0 ||
    failedIntegrityChecks.length > 0
      ? "error"
      : environment.some((item) => !item.configured) ||
          warningIntegrityChecks.length > 0
        ? "warning"
        : "ok";

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    adminEmail: context.adminEmail,
    overallStatus,
    deployment: {
      environment: process.env.VERCEL_ENV || "local",
      region: process.env.VERCEL_REGION || "unknown",
      siteUrl:
        process.env.NEXT_PUBLIC_SITE_URL || "https://www.jizhidao-ai.com",
      commit:
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "unknown",
    },
    environment,
    checks,
    integrityChecks,
  });
}

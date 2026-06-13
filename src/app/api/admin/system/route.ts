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
  const missingRequiredEnvironment = environment.filter(
    (item) => item.required && !item.configured
  );
  const failedChecks = checks.filter((item) => item.status === "error");
  const overallStatus: CheckStatus =
    missingRequiredEnvironment.length > 0 || failedChecks.length > 0
      ? "error"
      : environment.some((item) => !item.configured)
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
  });
}

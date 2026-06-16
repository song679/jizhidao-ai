import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

function getChinaDayStart(daysAgo = 0) {
  const shiftedNow = new Date(Date.now() + CHINA_OFFSET_MS);
  const utcMidnight = Date.UTC(
    shiftedNow.getUTCFullYear(),
    shiftedNow.getUTCMonth(),
    shiftedNow.getUTCDate() - daysAgo
  );

  return new Date(utcMidnight - CHINA_OFFSET_MS);
}

function getChinaDateKey(value: string) {
  return new Date(new Date(value).getTime() + CHINA_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function getModelLabel(description: string | null) {
  if (!description) {
    return "其他模型";
  }

  const matched = description.match(/^(.+?)\s*聊天扣除/);
  return matched?.[1]?.trim() || "其他模型";
}

export async function GET(request: Request) {
  try {
    const adminContext = await authorizeAdmin(request);

    if (adminContext.error) {
      return adminContext.error;
    }

    const todayStart = getChinaDayStart();
    const sevenDayStart = getChinaDayStart(6);
    const todayIso = todayStart.toISOString();
    const sevenDayIso = sevenDayStart.toISOString();
    const staleReservationIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const stalePaymentIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const orderExpiryHours = Math.min(
      168,
      Math.max(
        1,
        Number.parseInt(process.env.ORDER_EXPIRY_HOURS || "24", 10) || 24
      )
    );
    const activeOrderCutoffIso = new Date(
      Date.now() - orderExpiryHours * 60 * 60 * 1000
    ).toISOString();

    const [
      accountsResult,
      todayTransactionsResult,
      sevenDayTransactionsResult,
      recentActivityResult,
      todayLedgerResult,
      staleReservationsResult,
      pendingOrdersResult,
      stalePaymentEventsResult,
      failedPaymentEventsResult,
      mismatchedPaymentEventsResult,
    ] = await Promise.all([
      adminContext.supabaseAdmin
        .from("user_points")
        .select("id", { count: "exact", head: true }),
      adminContext.supabaseAdmin
        .from("point_transactions")
        .select("change_amount, type, description")
        .gte("created_at", todayIso)
        .limit(5000),
      adminContext.supabaseAdmin
        .from("point_transactions")
        .select("change_amount, type, description, created_at")
        .gte("created_at", sevenDayIso)
        .limit(10000),
      adminContext.supabaseAdmin
        .from("point_transactions")
        .select(
          "id, email, change_amount, balance_after, type, description, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(20),
      adminContext.supabaseAdmin
        .from("chat_request_ledger")
        .select("status, point_cost, model_name, created_at")
        .gte("created_at", todayIso)
        .limit(10000),
      adminContext.supabaseAdmin
        .from("chat_request_ledger")
        .select("request_id", { count: "exact", head: true })
        .eq("status", "reserved")
        .lt("created_at", staleReservationIso),
      adminContext.supabaseAdmin
        .from("recharge_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .gte("created_at", activeOrderCutoffIso),
      adminContext.supabaseAdmin
        .from("payment_webhook_events")
        .select("id", { count: "exact", head: true })
        .eq("processing_status", "received")
        .lt("received_at", stalePaymentIso),
      adminContext.supabaseAdmin
        .from("payment_webhook_events")
        .select("id", { count: "exact", head: true })
        .eq("processing_status", "failed")
        .gte("received_at", todayIso),
      adminContext.supabaseAdmin
        .from("payment_webhook_events")
        .select("id", { count: "exact", head: true })
        .eq("processing_status", "ignored")
        .eq("error_code", "amount_mismatch")
        .gte("received_at", todayIso),
    ]);

    const queryError = [
      accountsResult.error,
      todayTransactionsResult.error,
      sevenDayTransactionsResult.error,
      recentActivityResult.error,
      todayLedgerResult.error,
      staleReservationsResult.error,
      pendingOrdersResult.error,
      stalePaymentEventsResult.error,
      failedPaymentEventsResult.error,
      mismatchedPaymentEventsResult.error,
    ].find(Boolean);

    if (queryError) {
      console.error("加载运营数据失败：", queryError.message);
      return NextResponse.json(
        { error: "加载运营数据失败" },
        { status: 500 }
      );
    }

    const todayTransactions = todayTransactionsResult.data || [];
    const completedToday = todayTransactions.filter(
      (item) => item.type === "chat"
    ).length;
    const refundedToday = todayTransactions.filter(
      (item) => item.type === "refund"
    ).length;
    const todayPointsUsed = todayTransactions
      .filter((item) => item.type === "chat")
      .reduce((sum, item) => sum + Math.abs(item.change_amount || 0), 0);
    const todayRecharged = todayTransactions
      .filter((item) => item.type === "recharge")
      .reduce((sum, item) => sum + Math.max(item.change_amount || 0, 0), 0);
    const todayLedger = todayLedgerResult.data || [];
    const reservedToday = todayLedger.filter(
      (item) => item.status === "reserved"
    ).length;
    const completedLedgerToday = todayLedger.filter(
      (item) => item.status === "completed"
    ).length;
    const refundedLedgerToday = todayLedger.filter(
      (item) => item.status === "refunded"
    ).length;
    const finalizedToday = completedLedgerToday + refundedLedgerToday;
    const refundRate =
      finalizedToday > 0
        ? Math.round((refundedLedgerToday / finalizedToday) * 1000) / 10
        : 0;
    const dailyPointLimit = Number(process.env.CHAT_DAILY_POINT_LIMIT || 200);
    const healthIssues = [
      !process.env.OPENAI_API_KEY ? "OpenAI API 密钥未配置" : null,
      !process.env.DEEPSEEK_API_KEY ? "DeepSeek API 密钥未配置" : null,
      (staleReservationsResult.count || 0) > 0
        ? `存在 ${staleReservationsResult.count} 个滞留扣点请求`
        : null,
      refundRate >= 20 && finalizedToday >= 5
        ? `今日退款率偏高：${refundRate}%`
        : null,
      (stalePaymentEventsResult.count || 0) > 0
        ? `存在 ${stalePaymentEventsResult.count} 个超过 10 分钟未处理的支付回调`
        : null,
      (failedPaymentEventsResult.count || 0) > 0
        ? `今日有 ${failedPaymentEventsResult.count} 个支付回调处理失败`
        : null,
      (mismatchedPaymentEventsResult.count || 0) > 0
        ? `今日有 ${mismatchedPaymentEventsResult.count} 个支付金额不匹配事件`
        : null,
    ].filter((item): item is string => Boolean(item));

    const dailyMap = new Map<
      string,
      { date: string; chats: number; pointsUsed: number; recharged: number }
    >();

    for (let daysAgo = 6; daysAgo >= 0; daysAgo -= 1) {
      const date = getChinaDateKey(getChinaDayStart(daysAgo).toISOString());
      dailyMap.set(date, { date, chats: 0, pointsUsed: 0, recharged: 0 });
    }

    for (const transaction of sevenDayTransactionsResult.data || []) {
      const date = getChinaDateKey(transaction.created_at);
      const daily = dailyMap.get(date);

      if (!daily) continue;

      if (transaction.type === "chat") {
        daily.chats += 1;
        daily.pointsUsed += Math.abs(transaction.change_amount || 0);
      }

      if (transaction.type === "recharge") {
        daily.recharged += Math.max(transaction.change_amount || 0, 0);
      }
    }

    const modelMap = new Map<
      string,
      { model: string; requests: number; pointsUsed: number }
    >();

    for (const transaction of sevenDayTransactionsResult.data || []) {
      if (transaction.type !== "chat") continue;

      const modelLabel = getModelLabel(transaction.description);
      const current = modelMap.get(modelLabel) || {
        model: modelLabel,
        requests: 0,
        pointsUsed: 0,
      };
      current.requests += 1;
      current.pointsUsed += Math.abs(transaction.change_amount || 0);
      modelMap.set(modelLabel, current);
    }

    return NextResponse.json({
      adminEmail: adminContext.adminEmail,
      generatedAt: new Date().toISOString(),
      metrics: {
        accounts: accountsResult.count || 0,
        completedToday,
        refundedToday,
        todayPointsUsed,
        todayRecharged,
        pendingOrders: pendingOrdersResult.count || 0,
        paymentAlerts:
          (stalePaymentEventsResult.count || 0) +
          (failedPaymentEventsResult.count || 0) +
          (mismatchedPaymentEventsResult.count || 0),
      },
      daily: Array.from(dailyMap.values()),
      models: Array.from(modelMap.values()).sort(
        (left, right) => right.requests - left.requests
      ),
      recentActivity: recentActivityResult.data || [],
      health: {
        status: healthIssues.length === 0 ? "healthy" : "warning",
        issues: healthIssues,
        staleReservations: staleReservationsResult.count || 0,
        stalePaymentEvents: stalePaymentEventsResult.count || 0,
        failedPaymentEvents: failedPaymentEventsResult.count || 0,
        mismatchedPaymentEvents: mismatchedPaymentEventsResult.count || 0,
        reservedToday,
        completedToday: completedLedgerToday,
        refundedToday: refundedLedgerToday,
        refundRate,
        dailyPointLimit:
          Number.isFinite(dailyPointLimit) && dailyPointLimit > 0
            ? dailyPointLimit
            : 200,
        providers: {
          openai: Boolean(process.env.OPENAI_API_KEY),
          deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
        },
      },
    });
  } catch (error) {
    console.error("Admin Dashboard API Error:", error);

    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}

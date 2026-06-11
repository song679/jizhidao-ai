import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";

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

    const [
      accountsResult,
      completedTodayResult,
      refundedTodayResult,
      todayTransactionsResult,
      sevenDayTransactionsResult,
      modelUsageResult,
      recentActivityResult,
    ] = await Promise.all([
      adminContext.supabaseAdmin
        .from("user_points")
        .select("id", { count: "exact", head: true }),
      adminContext.supabaseAdmin
        .from("chat_request_ledger")
        .select("request_id", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("created_at", todayIso),
      adminContext.supabaseAdmin
        .from("chat_request_ledger")
        .select("request_id", { count: "exact", head: true })
        .eq("status", "refunded")
        .gte("created_at", todayIso),
      adminContext.supabaseAdmin
        .from("point_transactions")
        .select("change_amount, type")
        .gte("created_at", todayIso)
        .limit(5000),
      adminContext.supabaseAdmin
        .from("point_transactions")
        .select("change_amount, type, created_at")
        .gte("created_at", sevenDayIso)
        .limit(10000),
      adminContext.supabaseAdmin
        .from("chat_request_ledger")
        .select("model_name, point_cost, created_at")
        .eq("status", "completed")
        .gte("created_at", sevenDayIso)
        .limit(10000),
      adminContext.supabaseAdmin
        .from("point_transactions")
        .select(
          "id, email, change_amount, balance_after, type, description, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const queryError = [
      accountsResult.error,
      completedTodayResult.error,
      refundedTodayResult.error,
      todayTransactionsResult.error,
      sevenDayTransactionsResult.error,
      modelUsageResult.error,
      recentActivityResult.error,
    ].find(Boolean);

    if (queryError) {
      return NextResponse.json(
        { error: "加载运营数据失败", detail: queryError.message },
        { status: 500 }
      );
    }

    const todayTransactions = todayTransactionsResult.data || [];
    const todayPointsUsed = todayTransactions
      .filter((item) => item.type === "chat")
      .reduce((sum, item) => sum + Math.abs(item.change_amount || 0), 0);
    const todayRecharged = todayTransactions
      .filter((item) => item.type === "recharge")
      .reduce((sum, item) => sum + Math.max(item.change_amount || 0, 0), 0);

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

    for (const requestItem of modelUsageResult.data || []) {
      const current = modelMap.get(requestItem.model_name) || {
        model: requestItem.model_name,
        requests: 0,
        pointsUsed: 0,
      };
      current.requests += 1;
      current.pointsUsed += requestItem.point_cost || 0;
      modelMap.set(requestItem.model_name, current);
    }

    return NextResponse.json({
      adminEmail: adminContext.adminEmail,
      generatedAt: new Date().toISOString(),
      metrics: {
        accounts: accountsResult.count || 0,
        completedToday: completedTodayResult.count || 0,
        refundedToday: refundedTodayResult.count || 0,
        todayPointsUsed,
        todayRecharged,
      },
      daily: Array.from(dailyMap.values()),
      models: Array.from(modelMap.values()).sort(
        (left, right) => right.requests - left.requests
      ),
      recentActivity: recentActivityResult.data || [],
    });
  } catch (error) {
    console.error("Admin Dashboard API Error:", error);

    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}

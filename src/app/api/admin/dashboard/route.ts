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

    const [
      accountsResult,
      todayTransactionsResult,
      sevenDayTransactionsResult,
      recentActivityResult,
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
    ]);

    const queryError = [
      accountsResult.error,
      todayTransactionsResult.error,
      sevenDayTransactionsResult.error,
      recentActivityResult.error,
    ].find(Boolean);

    if (queryError) {
      return NextResponse.json(
        { error: "加载运营数据失败", detail: queryError.message },
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

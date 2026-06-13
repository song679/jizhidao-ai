"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { parsePointDescription } from "@/lib/point-description";

type DashboardData = {
  adminEmail: string;
  generatedAt: string;
  metrics: {
    accounts: number;
    completedToday: number;
    refundedToday: number;
    todayPointsUsed: number;
    todayRecharged: number;
    pendingOrders: number;
  };
  daily: Array<{
    date: string;
    chats: number;
    pointsUsed: number;
    recharged: number;
  }>;
  models: Array<{
    model: string;
    requests: number;
    pointsUsed: number;
  }>;
  recentActivity: Array<{
    id: string;
    email: string;
    change_amount: number;
    balance_after: number;
    type: string;
    description: string | null;
    created_at: string;
  }>;
  health: {
    status: "healthy" | "warning";
    issues: string[];
    staleReservations: number;
    reservedToday: number;
    completedToday: number;
    refundedToday: number;
    refundRate: number;
    dailyPointLimit: number;
    providers: {
      openai: boolean;
      deepseek: boolean;
    };
  };
};

const transactionLabels: Record<string, string> = {
  chat: "AI 聊天",
  recharge: "充值",
  refund: "退还",
  gift: "赠送",
  deduction: "管理员扣减",
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  function formatTime(value: string) {
    return new Date(value).toLocaleString("zh-CN", {
      hour12: false,
      timeZone: "Asia/Shanghai",
    });
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      timeZone: "Asia/Shanghai",
    }).format(new Date(`${value}T00:00:00+08:00`));
  }

  async function loadDashboard() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.assign("/login");
        return;
      }

      const response = await fetch("/api/admin/dashboard", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData?.error || "加载运营概览失败");
      }

      setData(responseData);
    } catch (error) {
      console.error("加载运营概览失败：", error);
      setMessage(error instanceof Error ? error.message : "加载运营概览失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadDashboard, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const maxDailyChats = Math.max(
    1,
    ...(data?.daily.map((item) => item.chats) || [1])
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <Link href="/" className="text-2xl font-bold">
            极智岛 AI
          </Link>

          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href="/admin/users"
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
            >
              用户管理
            </Link>
            <Link
              href="/admin/recharge"
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
            >
              点数管理
            </Link>
            <Link
              href="/admin/orders"
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
            >
              充值订单
              {(data?.metrics.pendingOrders || 0) > 0 && (
                <span className="rounded-full bg-amber-300 px-2 py-0.5 text-xs font-bold text-slate-950">
                  {data?.metrics.pendingOrders}
                </span>
              )}
            </Link>
            <Link
              href="/admin/transactions"
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
            >
              点数流水
            </Link>
            <Link
              href="/admin/system"
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
            >
              系统状态
            </Link>
            <Link
              href="/chat"
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
            >
              返回聊天
            </Link>
          </nav>
        </header>

        <section className="py-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-cyan-300">管理员工具</p>
              <h1 className="mt-2 text-3xl font-bold">运营概览</h1>
              <p className="mt-2 text-sm text-slate-400">
                {data?.adminEmail || "正在验证管理员权限..."}
              </p>
            </div>
            <button
              type="button"
              onClick={loadDashboard}
              disabled={loading}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "刷新中..." : "刷新数据"}
            </button>
          </div>
        </section>

        {message && (
          <div className="mb-6 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {message}
          </div>
        )}

        {data?.health && (
          <section
            className={`mb-6 rounded-lg border p-5 ${
              data.health.status === "healthy"
                ? "border-emerald-400/30 bg-emerald-400/10"
                : "border-amber-400/30 bg-amber-400/10"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p
                  className={`text-sm font-bold ${
                    data.health.status === "healthy"
                      ? "text-emerald-200"
                      : "text-amber-200"
                  }`}
                >
                  {data.health.status === "healthy"
                    ? "系统运行正常"
                    : "系统存在需要关注的项目"}
                </p>
                <p className="mt-2 text-xs leading-6 text-slate-300">
                  OpenAI：{data.health.providers.openai ? "已配置" : "未配置"}
                  {" · "}
                  DeepSeek：
                  {data.health.providers.deepseek ? "已配置" : "未配置"}
                  {" · "}
                  单用户每日上限：
                  {data.health.dailyPointLimit.toLocaleString()} 点
                </p>
              </div>
              <div className="text-right text-xs text-slate-300">
                <p>今日退款率 {data.health.refundRate}%</p>
                <p className="mt-1">
                  滞留请求 {data.health.staleReservations} 个
                </p>
              </div>
            </div>

            {data.health.issues.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-amber-300/20 pt-4 text-sm text-amber-100">
                {data.health.issues.map((issue) => (
                  <li key={issue}>• {issue}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        {(data?.metrics.pendingOrders || 0) > 0 && (
          <Link
            href="/admin/orders?status=pending"
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-amber-100 transition hover:border-amber-300/60"
          >
            <span className="font-semibold">
              有 {data?.metrics.pendingOrders} 个充值订单等待确认
            </span>
            <span className="text-sm">立即处理 →</span>
          </Link>
        )}

        <section className="grid gap-px overflow-hidden rounded-lg border border-slate-800 bg-slate-800 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            ["点数账户", data?.metrics.accounts ?? 0, "累计初始化用户"],
            [
              "今日 AI 调用",
              data?.metrics.completedToday ?? 0,
              "成功完成请求",
            ],
            [
              "今日消耗",
              data?.metrics.todayPointsUsed ?? 0,
              "聊天消耗点数",
            ],
            [
              "今日充值",
              data?.metrics.todayRecharged ?? 0,
              "管理员充值点数",
            ],
            [
              "今日退还",
              data?.metrics.refundedToday ?? 0,
              "失败请求已退款",
            ],
            [
              "待处理订单",
              data?.metrics.pendingOrders ?? 0,
              "有效期内待确认",
            ],
          ].map(([label, value, note]) => (
            <div key={label} className="bg-slate-950 px-5 py-5">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="mt-2 text-2xl font-bold text-cyan-300">
                {Number(value).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">{note}</p>
            </div>
          ))}
        </section>

        {data?.health && (
          <section className="mt-6 grid gap-px overflow-hidden rounded-lg border border-slate-800 bg-slate-800 sm:grid-cols-3">
            {[
              [
                "账本已完成",
                data.health.completedToday,
                "今日成功结算请求",
              ],
              [
                "账本预扣中",
                data.health.reservedToday,
                "正常请求或尚未回收",
              ],
              [
                "账本已退款",
                data.health.refundedToday,
                "失败或中断请求",
              ],
            ].map(([label, value, note]) => (
              <div key={label} className="bg-slate-950 px-5 py-4">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-2 text-xl font-bold text-cyan-300">
                  {Number(value).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-slate-500">{note}</p>
              </div>
            ))}
          </section>
        )}

        <section className="grid gap-8 py-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="min-w-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">近 7 天 AI 使用</h2>
              <span className="text-xs text-slate-500">北京时间</span>
            </div>

            <div className="mt-4 space-y-3 md:hidden">
              {(data?.daily || []).map((item) => (
                <article
                  key={item.date}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-bold">{formatDate(item.date)}</p>
                    <p className="font-bold text-cyan-300">
                      {item.chats.toLocaleString()} 次
                    </p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded bg-slate-800">
                    <div
                      className="h-full rounded bg-cyan-400"
                      style={{
                        width: `${Math.max(
                          item.chats > 0 ? 8 : 0,
                          (item.chats / maxDailyChats) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-950/70 p-3">
                      <p className="text-xs text-slate-500">消耗点数</p>
                      <p className="mt-1 font-semibold">
                        {item.pointsUsed.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-950/70 p-3 text-right">
                      <p className="text-xs text-slate-500">充值点数</p>
                      <p className="mt-1 font-semibold text-cyan-300">
                        {item.recharged.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
              {!loading && !data?.daily.length && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-10 text-center text-sm text-slate-400">
                  暂无运营数据。
                </div>
              )}
            </div>

            <div className="mt-4 hidden overflow-x-auto rounded-lg border border-slate-800 md:block">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="bg-slate-900 text-left text-xs text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">日期</th>
                    <th className="px-4 py-3 font-semibold">调用趋势</th>
                    <th className="px-4 py-3 text-right font-semibold">调用</th>
                    <th className="px-4 py-3 text-right font-semibold">消耗</th>
                    <th className="px-4 py-3 text-right font-semibold">充值</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(data?.daily || []).map((item) => (
                    <tr key={item.date}>
                      <td className="px-4 py-4 font-semibold">
                        {formatDate(item.date)}
                      </td>
                      <td className="w-48 px-4 py-4">
                        <div className="h-2 overflow-hidden rounded bg-slate-800">
                          <div
                            className="h-full rounded bg-cyan-400"
                            style={{
                              width: `${Math.max(
                                item.chats > 0 ? 8 : 0,
                                (item.chats / maxDailyChats) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">{item.chats}</td>
                      <td className="px-4 py-4 text-right text-slate-300">
                        {item.pointsUsed.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right text-cyan-300">
                        {item.recharged.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {!loading && !data?.daily.length && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-slate-400"
                      >
                        暂无运营数据。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="min-w-0 border-t border-slate-800 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">模型使用分布</h2>
              <span className="text-xs text-slate-500">近 7 天</span>
            </div>

            <div className="mt-4 divide-y divide-slate-800 border-y border-slate-800">
              {(data?.models || []).map((item) => (
                <div
                  key={item.model}
                  className="grid grid-cols-[1fr_auto] gap-4 py-4 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold" title={item.model}>
                      {item.model}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      消耗 {item.pointsUsed.toLocaleString()} 点
                    </p>
                  </div>
                  <p className="font-bold text-cyan-300">
                    {item.requests.toLocaleString()} 次
                  </p>
                </div>
              ))}
              {!loading && !data?.models.length && (
                <p className="py-8 text-sm text-slate-400">
                  近 7 天还没有成功的 AI 调用。
                </p>
              )}
            </div>
          </aside>
        </section>

        <section className="border-t border-slate-800 py-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">最近点数活动</h2>
            <span className="text-xs text-slate-500">最近 20 条</span>
          </div>

          <div className="mt-4 space-y-3 md:hidden">
            {(data?.recentActivity || []).map((item) => {
              const description = parsePointDescription(item.description);

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="break-all font-semibold">{item.email}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatTime(item.created_at)}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 text-lg font-bold ${
                        item.change_amount >= 0
                          ? "text-cyan-300"
                          : "text-rose-300"
                      }`}
                    >
                      {item.change_amount >= 0 ? "+" : ""}
                      {item.change_amount.toLocaleString()}
                    </p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-950/70 p-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">类型</p>
                      <p className="mt-1 font-semibold">
                        {transactionLabels[item.type] || item.type}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">变动后余额</p>
                      <p className="mt-1 font-semibold">
                        {item.balance_after.toLocaleString()} 点
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 break-words text-sm text-slate-300">
                    {description.note || "无说明"}
                  </p>
                  {description.adminEmail && (
                    <p className="mt-2 break-all text-xs text-slate-500">
                      操作管理员：{description.adminEmail}
                    </p>
                  )}
                </article>
              );
            })}
            {!loading && !data?.recentActivity.length && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-10 text-center text-sm text-slate-400">
                暂无点数活动。
              </div>
            )}
          </div>

          <div className="mt-4 hidden overflow-x-auto rounded-lg border border-slate-800 md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-900 text-xs text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">用户</th>
                  <th className="px-4 py-3 font-semibold">类型</th>
                  <th className="px-4 py-3 font-semibold">说明</th>
                  <th className="px-4 py-3 text-right font-semibold">变动</th>
                  <th className="px-4 py-3 text-right font-semibold">余额</th>
                  <th className="px-4 py-3 font-semibold">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(data?.recentActivity || []).map((item) => (
                  <tr key={item.id}>
                    <td className="max-w-52 truncate px-4 py-4 font-semibold">
                      {item.email}
                    </td>
                    <td className="px-4 py-4">
                      {transactionLabels[item.type] || item.type}
                    </td>
                    <td className="max-w-60 px-4 py-4 text-slate-400">
                      <span className="block truncate">
                        {parsePointDescription(item.description).note ||
                          "无说明"}
                      </span>
                      {parsePointDescription(item.description).adminEmail && (
                        <span className="mt-1 block truncate text-xs text-slate-600">
                          {parsePointDescription(item.description).adminEmail}
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-4 text-right font-bold ${
                        item.change_amount >= 0
                          ? "text-cyan-300"
                          : "text-rose-300"
                      }`}
                    >
                      {item.change_amount >= 0 ? "+" : ""}
                      {item.change_amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {item.balance_after.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500">
                      {formatTime(item.created_at)}
                    </td>
                  </tr>
                ))}
                {!loading && !data?.recentActivity.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-slate-400"
                    >
                      暂无点数活动。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {data?.generatedAt && (
            <p className="mt-3 text-right text-xs text-slate-500">
              数据更新时间：{formatTime(data.generatedAt)}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

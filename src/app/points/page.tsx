"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { parsePointDescription } from "@/lib/point-description";

type Transaction = {
  id: string;
  change_amount: number;
  balance_after: number;
  type: string;
  description: string | null;
  created_at: string;
};

export default function PointsPage() {
  const [userEmail, setUserEmail] = useState("");
  const [points, setPoints] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadPoints = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/points", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "加载点数明细失败");
      }

      setUserEmail(data.email || "");
      setPoints(typeof data.points === "number" ? data.points : 0);
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error("加载点数明细失败：", error);
      setMessage(error instanceof Error ? error.message : "加载点数明细失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPoints(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPoints]);

  function formatType(type: string) {
    if (type === "chat") return "AI聊天";
    if (type === "recharge") return "充值";
    if (type === "gift") return "赠送";
    if (type === "refund") return "退还";
    if (type === "deduction") return "管理员扣减";
    return type;
  }

  function formatTime(value: string) {
    return new Date(value).toLocaleString("zh-CN", {
      hour12: false,
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const totalRecharged = transactions
    .filter((item) => item.type === "recharge" || item.type === "gift")
    .reduce((sum, item) => sum + Math.max(item.change_amount, 0), 0);
  const totalUsed = transactions
    .filter((item) => item.type === "chat" || item.type === "deduction")
    .reduce((sum, item) => sum + Math.abs(Math.min(item.change_amount, 0)), 0);
  const totalRefunded = transactions
    .filter((item) => item.type === "refund")
    .reduce((sum, item) => sum + Math.max(item.change_amount, 0), 0);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-6 sm:py-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6 md:mb-12">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            极智岛 AI
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="/chat" className="hover:text-white">
              AI聊天
            </a>
            <a href="/pricing" className="hover:text-white">
              会员价格
            </a>
            <a href="/points" className="text-cyan-300">
              点数明细
            </a>
            <a href="/account" className="hover:text-white">
              我的账户
            </a>
          </nav>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {userEmail && (
              <span className="hidden text-sm text-slate-300 md:inline">
                {userEmail}
              </span>
            )}

            <a
              href="/chat"
              className="rounded-full border border-cyan-400/40 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10"
            >
              进入 AI 聊天
            </a>

            <button
              onClick={logout}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200 sm:px-5"
            >
              退出登录
            </button>
          </div>
        </header>

        <nav className="mb-4 grid grid-cols-3 gap-2 text-center text-sm md:hidden">
          <Link
            href="/pricing"
            className="rounded-xl border border-slate-700 px-3 py-3 text-slate-300"
          >
            充值
          </Link>
          <Link
            href="/orders"
            className="rounded-xl border border-slate-700 px-3 py-3 text-slate-300"
          >
            订单
          </Link>
          <Link
            href="/account"
            className="rounded-xl border border-slate-700 px-3 py-3 text-slate-300"
          >
            账户
          </Link>
        </nav>

        <section className="py-8 md:py-12">
          <p className="mb-4 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300">
            账户点数
          </p>

          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            点数明细
          </h1>

          <p className="mt-4 text-slate-400">
            当前账号：{userEmail || "加载中..."}
          </p>
        </section>

        {message && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            <span>{message}</span>
            <button
              type="button"
              onClick={() => void loadPoints()}
              className="font-semibold underline"
            >
              重新加载
            </button>
          </div>
        )}

        {!loading && transactions.length > 0 && (
          <section className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
            {[
              ["最近充值", totalRecharged],
              ["最近消耗", totalUsed],
              ["最近退还", totalRefunded],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-4 text-center sm:px-5"
              >
                <p className="text-[11px] text-slate-500 sm:text-xs">{label}</p>
                <p className="mt-2 text-lg font-bold text-cyan-300 sm:text-2xl">
                  {Number(value).toLocaleString()}
                </p>
              </div>
            ))}
          </section>
        )}

        <section className="grid gap-6 md:grid-cols-[1fr_2fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8">
            <p className="text-sm text-slate-400">当前剩余点数</p>

            <div className="mt-4 text-5xl font-bold text-cyan-300">
              {loading ? "..." : points ?? 0}
            </div>

            <p className="mt-3 text-sm text-slate-500">
              点数用于 AI 聊天、写作、电商文案、短视频脚本等功能。
            </p>

            <a
              href="/pricing"
              className="mt-8 inline-block rounded-2xl bg-cyan-400 px-6 py-4 font-bold text-slate-950 hover:bg-cyan-300"
            >
              充值点数
            </a>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold">最近点数变动</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">最多显示 30 条</span>
                <button
                  type="button"
                  onClick={() => void loadPoints()}
                  disabled={loading}
                  className="text-sm font-semibold text-cyan-300 disabled:opacity-50"
                >
                  刷新
                </button>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800">
              {loading ? (
                <div className="p-6 text-sm text-slate-400">加载中...</div>
              ) : transactions.length === 0 ? (
                <div className="p-6 text-sm text-slate-400">
                  暂时还没有点数记录。
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {transactions.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-4 p-5 text-sm md:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-bold text-white">
                            {formatType(item.type)}
                          </span>

                          <span
                            className={
                              item.change_amount > 0
                                ? "font-bold text-cyan-300"
                                : "font-bold text-rose-300"
                            }
                          >
                            {item.change_amount > 0 ? "+" : ""}
                            {item.change_amount}
                          </span>
                        </div>

                        <p className="mt-2 text-slate-400">
                          {parsePointDescription(item.description).note ||
                            "点数变动"}
                        </p>

                        <p className="mt-2 text-xs text-slate-500">
                          {formatTime(item.created_at)}
                        </p>
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-xs text-slate-500">变动后余额</p>
                        <p className="mt-1 text-lg font-bold text-slate-200">
                          {item.balance_after}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

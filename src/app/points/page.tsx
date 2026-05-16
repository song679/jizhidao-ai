"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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

  useEffect(() => {
        async function loadPoints() {
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

      const data = await response.json();

      if (!response.ok) {
        console.error(data);
        setLoading(false);
        return;
      }

      setUserEmail(data.email || "");
      setPoints(typeof data.points === "number" ? data.points : 0);
      setTransactions(data.transactions || []);
      setLoading(false);
    }

    loadPoints();
  }, []);

  function formatType(type: string) {
    if (type === "chat") return "AI聊天";
    if (type === "recharge") return "充值";
    if (type === "gift") return "赠送";
    return type;
  }

  function formatTime(value: string) {
    return new Date(value).toLocaleString("zh-CN", {
      hour12: false,
    });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <a href="/" className="text-2xl font-bold">
            极智岛 AI
          </a>

          <nav className="flex items-center gap-6 text-sm text-slate-300">
            <a href="/chat" className="hover:text-white">
              AI聊天
            </a>
            <a href="/pricing" className="hover:text-white">
              会员价格
            </a>
            <a href="/points" className="text-cyan-300">
              点数明细
            </a>
          </nav>
        </header>

        <section className="py-12">
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
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">最近点数变动</h2>
              <span className="text-sm text-slate-500">最多显示 30 条</span>
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
                          {item.description || "点数变动"}
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
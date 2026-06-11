"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Transaction = {
  id: string;
  change_amount: number;
  balance_after: number;
  type: string;
  description: string | null;
  created_at: string;
};

const transactionLabels: Record<string, string> = {
  chat: "AI 聊天",
  recharge: "充值",
  refund: "退还",
  gift: "赠送",
};

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [points, setPoints] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          window.location.assign("/login");
          return;
        }

        const response = await fetch("/api/points", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "加载账户信息失败");
        }

        setEmail(data.email || session.user.email || "");
        setPoints(typeof data.points === "number" ? data.points : 0);
        setTransactions(
          Array.isArray(data.transactions) ? data.transactions : []
        );
      } catch (error) {
        console.error("加载账户信息失败：", error);
        setMessage(error instanceof Error ? error.message : "加载账户信息失败");
      } finally {
        setLoading(false);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const stats = useMemo(() => {
    return transactions.reduce(
      (summary, transaction) => {
        if (transaction.type === "chat") {
          summary.chatRequests += 1;
          summary.pointsUsed += Math.abs(transaction.change_amount || 0);
        }

        if (transaction.type === "recharge") {
          summary.recharged += Math.max(transaction.change_amount || 0, 0);
        }

        return summary;
      },
      { chatRequests: 0, pointsUsed: 0, recharged: 0 }
    );
  }, [transactions]);

  function formatTime(value: string) {
    return new Date(value).toLocaleString("zh-CN", {
      hour12: false,
      timeZone: "Asia/Shanghai",
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-5 py-8 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <Link href="/" className="text-2xl font-bold">
            极智岛 AI
          </Link>

          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href="/chat"
              className="rounded-lg border border-cyan-400/40 px-4 py-2 font-semibold text-cyan-300 hover:bg-cyan-400/10"
            >
              进入 AI 聊天
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:text-white"
            >
              充值点数
            </Link>
          </nav>
        </header>

        <section className="py-8">
          <p className="text-sm font-semibold text-cyan-300">账户中心</p>
          <h1 className="mt-2 text-3xl font-bold">我的账户</h1>
          <p className="mt-3 break-all text-sm text-slate-400">
            {loading ? "正在加载账户信息..." : email}
          </p>
        </section>

        {message && (
          <div className="mb-6 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {message}
          </div>
        )}

        <section className="grid gap-px overflow-hidden rounded-lg border border-slate-800 bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["当前余额", points, "可用于所有 AI 功能"],
            ["最近 AI 调用", stats.chatRequests, "最近 30 条流水内"],
            ["最近消耗", stats.pointsUsed, "最近 30 条流水内"],
            ["最近充值", stats.recharged, "最近 30 条流水内"],
          ].map(([label, value, note]) => (
            <div key={label} className="bg-slate-950 px-5 py-5">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="mt-2 text-2xl font-bold text-cyan-300">
                {loading ? "..." : Number(value).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">{note}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-8 py-8 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="text-xl font-bold">快捷操作</h2>
            <div className="mt-4 divide-y divide-slate-800 rounded-lg border border-slate-800">
              <Link
                href="/chat"
                className="flex items-center justify-between px-5 py-4 text-sm hover:bg-slate-900"
              >
                <span>
                  <strong className="block">继续使用 AI</strong>
                  <span className="mt-1 block text-xs text-slate-500">
                    进入聊天并选择需要的模型
                  </span>
                </span>
                <span className="text-cyan-300">进入</span>
              </Link>
              <Link
                href="/points"
                className="flex items-center justify-between px-5 py-4 text-sm hover:bg-slate-900"
              >
                <span>
                  <strong className="block">完整点数明细</strong>
                  <span className="mt-1 block text-xs text-slate-500">
                    查看最近 30 条余额变动
                  </span>
                </span>
                <span className="text-cyan-300">查看</span>
              </Link>
              <Link
                href="/pricing"
                className="flex items-center justify-between px-5 py-4 text-sm hover:bg-slate-900"
              >
                <span>
                  <strong className="block">充值与会员</strong>
                  <span className="mt-1 block text-xs text-slate-500">
                    查看点数套餐和管理员联系方式
                  </span>
                </span>
                <span className="text-cyan-300">查看</span>
              </Link>
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-bold">账户与规则</h2>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <Link
                  href="/terms"
                  className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:text-white"
                >
                  用户协议
                </Link>
                <Link
                  href="/privacy"
                  className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:text-white"
                >
                  隐私政策
                </Link>
                <Link
                  href="/refund"
                  className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:text-white"
                >
                  充值与退款
                </Link>
              </div>
              <button
                type="button"
                onClick={logout}
                className="mt-6 rounded-lg border border-rose-400/40 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-400/10"
              >
                安全退出登录
              </button>
            </div>
          </div>

          <div className="min-w-0 border-t border-slate-800 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">最近账户活动</h2>
              <Link
                href="/points"
                className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
              >
                查看全部
              </Link>
            </div>

            <div className="mt-4 divide-y divide-slate-800 border-y border-slate-800">
              {loading ? (
                <p className="py-8 text-sm text-slate-400">正在加载...</p>
              ) : transactions.length === 0 ? (
                <p className="py-8 text-sm text-slate-400">
                  暂时没有账户活动。
                </p>
              ) : (
                transactions.slice(0, 8).map((transaction) => (
                  <div
                    key={transaction.id}
                    className="grid grid-cols-[1fr_auto] gap-4 py-4 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {transactionLabels[transaction.type] ||
                          transaction.type}
                      </p>
                      <p className="mt-1 truncate text-slate-400">
                        {transaction.description || "点数变动"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatTime(transaction.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={
                          transaction.change_amount >= 0
                            ? "font-bold text-cyan-300"
                            : "font-bold text-rose-300"
                        }
                      >
                        {transaction.change_amount >= 0 ? "+" : ""}
                        {transaction.change_amount.toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        余额 {transaction.balance_after.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

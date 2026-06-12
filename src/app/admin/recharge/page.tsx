"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type RechargeRecord = {
  id: string;
  email: string;
  change_amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
};

type PointOperation = "add" | "deduct";

const rechargePresets = [
  { name: "体验包", amount: 1000 },
  { name: "标准包", amount: 5000 },
  { name: "进阶包", amount: 20000 },
];

export default function AdminRechargePage() {
  const [adminEmail, setAdminEmail] = useState("");
  const [accessChecking, setAccessChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");
  const [accountPoints, setAccountPoints] = useState<number | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [operation, setOperation] = useState<PointOperation>("add");
  const [amount, setAmount] = useState("1000");
  const [note, setNote] = useState("管理员手动充值");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [recentRecharges, setRecentRecharges] = useState<RechargeRecord[]>([]);

  function formatTime(value: string) {
    return new Date(value).toLocaleString("zh-CN", {
      hour12: false,
    });
  }

  async function loadRecentRecharges(accessToken: string) {
    const response = await fetch("/api/admin/recharge", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || "无法加载管理员信息");
    }

    setAdminEmail(data.adminEmail || "");
    setRecentRecharges(
      Array.isArray(data.recentRecharges) ? data.recentRecharges : []
    );
    setAuthorized(true);
  }

  useEffect(() => {
    async function loadAdmin() {
      const emailFromQuery = new URLSearchParams(window.location.search).get(
        "email"
      );

      if (emailFromQuery) {
        setTargetEmail(emailFromQuery);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      try {
        await loadRecentRecharges(session.access_token);
      } catch (error) {
        console.error("管理员权限验证失败：", error);
        setMessage(
          error instanceof Error
            ? error.message
            : "暂时无法验证管理员权限，请稍后再试"
        );
      } finally {
        setAccessChecking(false);
      }
    }

    loadAdmin();
  }, []);

  async function lookupAccount() {
    const email = targetEmail.trim();

    if (!email) {
      setSuccess(false);
      setMessage("请先输入用户邮箱");
      return;
    }

    setLookupLoading(true);
    setAccountPoints(null);
    setMessage("");
    setSuccess(false);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch(
        `/api/admin/recharge?email=${encodeURIComponent(email)}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "查询用户失败");
      }

      setAccountPoints(data.points);
      setSuccess(true);
      setMessage(
        data.initialized
          ? `账号已找到，当前余额 ${data.points} 点。`
          : `账号已注册，尚未初始化点数记录，充值前基础余额为 ${data.points} 点。`
      );
    } catch (error) {
      console.error("查询用户账号失败：", error);
      setMessage(error instanceof Error ? error.message : "查询用户失败");
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleRecharge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);

    const confirmed = window.confirm(
      `确定要为 ${targetEmail.trim()} ${
        operation === "deduct" ? "扣减" : "增加"
      } ${amount} 点吗？此操作会写入用户点数流水。`
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/admin/recharge", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: targetEmail,
          amount: Number(amount),
          operation,
          note,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "充值失败");
      }

      setSuccess(true);
      setMessage(
        `操作成功：${data.email} ${
          data.changeAmount >= 0 ? "增加" : "扣减"
        } ${Math.abs(data.changeAmount)} 点，当前余额 ${data.points} 点。`
      );
      setAccountPoints(data.points);
      await loadRecentRecharges(session.access_token);
    } catch (error) {
      console.error("管理员充值失败：", error);
      setMessage(error instanceof Error ? error.message : "充值失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <Link href="/" className="text-2xl font-bold">
            极智岛 AI
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/admin"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
            >
              运营概览
            </Link>
            <Link
              href="/admin/users"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
            >
              用户管理
            </Link>
            <Link
              href="/chat"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
            >
              返回聊天
            </Link>
          </nav>
        </header>

        <section className="py-12">
          <p className="text-sm font-semibold text-cyan-300">管理员工具</p>
          <h1 className="mt-3 text-4xl font-bold">点数管理</h1>
          <p className="mt-4 text-sm text-slate-400">
            当前登录账号：
            {accessChecking ? "正在检查管理员权限..." : adminEmail || "未授权"}
          </p>
        </section>

        {!accessChecking && !authorized ? (
          <section className="border-y border-red-400/30 bg-red-400/10 px-5 py-6 text-sm text-red-100">
            {message || "当前账号没有管理员权限。"}
          </section>
        ) : (
          <form
            onSubmit={handleRecharge}
            className="border-y border-slate-800 py-8"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-300">
                  操作类型
                </span>
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-2">
                  {[
                    {
                      id: "add" as const,
                      label: "增加点数",
                      note: "充值、赠送或运营补偿",
                    },
                    {
                      id: "deduct" as const,
                      label: "扣减点数",
                      note: "退款扣回或误充值纠正",
                    },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setOperation(item.id);
                        setNote(
                          item.id === "deduct"
                            ? "管理员手动扣减"
                            : "管理员手动充值"
                        );
                      }}
                      className={`rounded-lg px-4 py-3 text-left ${
                        operation === item.id
                          ? "bg-cyan-400 text-slate-950"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <strong className="block text-sm">{item.label}</strong>
                      <span
                        className={`mt-1 block text-xs ${
                          operation === item.id
                            ? "text-slate-800"
                            : "text-slate-500"
                        }`}
                      >
                        {item.note}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-300">
                  用户登录邮箱
                </span>
                <div className="flex gap-3">
                  <input
                    type="email"
                    value={targetEmail}
                    onChange={(event) => {
                      setTargetEmail(event.target.value);
                      setAccountPoints(null);
                    }}
                    required
                    placeholder="用户注册网站时使用的邮箱"
                    className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={lookupAccount}
                    disabled={lookupLoading || !authorized}
                    className="shrink-0 rounded-lg border border-cyan-400/40 px-5 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {lookupLoading ? "查询中..." : "查询账号"}
                  </button>
                </div>
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-300">
                  {operation === "deduct" ? "扣减点数" : "增加点数"}
                </span>
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  step="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400"
                />
                {operation === "add" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {rechargePresets.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setAmount(String(preset.amount));
                        setNote(`${preset.name}充值`);
                      }}
                      className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
                    >
                      {preset.name} · {preset.amount.toLocaleString()} 点
                    </button>
                    ))}
                  </div>
                )}
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-300">
                  操作说明
                </span>
                <input
                  type="text"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={200}
                  placeholder={
                    operation === "deduct"
                      ? "例如：退款后扣回未使用点数"
                      : "例如：标准包充值"
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
                />
              </label>
            </div>

            {message && (
              <div
                className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
                  success
                    ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                    : "border-red-400/30 bg-red-400/10 text-red-100"
                }`}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={
                loading ||
                accessChecking ||
                !authorized ||
                accountPoints === null
              }
              className="mt-8 w-full rounded-lg bg-cyan-400 px-6 py-4 font-bold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "正在处理..."
                : accountPoints === null
                  ? "请先查询并确认用户账号"
                  : `确认${
                      operation === "deduct" ? "扣减" : "增加"
                    }点数（当前 ${accountPoints} 点）`}
            </button>
          </form>
        )}

        <section className="py-8 text-sm leading-7 text-slate-400">
          <p>操作成功后，系统会同步更新用户余额并写入点数明细。</p>
          <p>扣减点数不会允许余额变成负数，提交前请再次核对用户邮箱、金额和说明。</p>
        </section>

        {authorized && (
          <section className="border-t border-slate-800 py-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-cyan-300">
                  点数调整流水
                </p>
                <h2 className="mt-2 text-2xl font-bold">最近管理操作</h2>
              </div>
              <span className="text-xs text-slate-500">最多显示 20 条</span>
            </div>

            <div className="mt-6 overflow-hidden rounded-lg border border-slate-800">
              {recentRecharges.length === 0 ? (
                <div className="px-5 py-8 text-sm text-slate-400">
                  暂时还没有管理操作记录。
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {recentRecharges.map((record) => (
                    <div
                      key={record.id}
                      className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[1fr_auto]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {record.email}
                        </p>
                        <p className="mt-1 text-slate-400">
                          {record.description ||
                            (record.change_amount >= 0
                              ? "管理员手动充值"
                              : "管理员手动扣减")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatTime(record.created_at)}
                        </p>
                      </div>

                      <div className="md:text-right">
                        <p
                          className={`font-bold ${
                            record.change_amount >= 0
                              ? "text-cyan-300"
                              : "text-rose-300"
                          }`}
                        >
                          {record.change_amount >= 0 ? "+" : ""}
                          {record.change_amount.toLocaleString()} 点
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          余额 {record.balance_after.toLocaleString()} 点
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

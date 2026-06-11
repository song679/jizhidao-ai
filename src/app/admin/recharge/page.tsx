"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function AdminRechargePage() {
  const [adminEmail, setAdminEmail] = useState("");
  const [accessChecking, setAccessChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");
  const [accountPoints, setAccountPoints] = useState<number | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [amount, setAmount] = useState("1000");
  const [note, setNote] = useState("管理员手动充值");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadAdmin() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      try {
        const response = await fetch("/api/admin/recharge", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const data = await response.json();

        if (!response.ok) {
          setMessage(data?.error || "无法验证管理员权限");
          return;
        }

        setAdminEmail(data.adminEmail || session.user.email || "");
        setAuthorized(true);
      } catch (error) {
        console.error("管理员权限验证失败：", error);
        setMessage("暂时无法验证管理员权限，请稍后再试");
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
      `确定要为 ${targetEmail.trim()} 增加 ${amount} 点吗？`
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
          note,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "充值失败");
      }

      setSuccess(true);
      setMessage(
        `充值成功：${data.email} 增加 ${data.addedPoints} 点，当前余额 ${data.points} 点。`
      );
      setAccountPoints(data.points);
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

          <Link
            href="/chat"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
          >
            返回聊天
          </Link>
        </header>

        <section className="py-12">
          <p className="text-sm font-semibold text-cyan-300">管理员工具</p>
          <h1 className="mt-3 text-4xl font-bold">手动充值点数</h1>
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
                  增加点数
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
              </label>

              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-300">
                  充值说明
                </span>
                <input
                  type="text"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={200}
                  placeholder="例如：标准包充值"
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
                  : `确认增加点数（当前 ${accountPoints} 点）`}
            </button>
          </form>
        )}

        <section className="py-8 text-sm leading-7 text-slate-400">
          <p>充值成功后，系统会同步更新用户余额并写入点数明细。</p>
          <p>提交前请再次核对用户邮箱和充值点数，避免加错账号。</p>
        </section>
      </div>
    </main>
  );
}

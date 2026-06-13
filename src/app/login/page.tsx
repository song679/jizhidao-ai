"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [sentEmail, setSentEmail] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [accountDeleted, setAccountDeleted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAccountDeleted(
        new URLSearchParams(window.location.search).get("account_deleted") ===
          "1"
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  async function handleLogin(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const userEmail = email.trim().toLowerCase();

    if (!userEmail) {
      setMessage("请先输入邮箱。");
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: userEmail,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(`发送失败：${data?.error || "请稍后再试"}`);
        setMessageType("error");
      } else {
        setSentEmail(userEmail);
        setResendSeconds(60);
        setMessageType("success");
        setMessage(
          `${data?.message ||
            "登录链接已发送到你的邮箱，请打开邮箱点击链接登录。"}${
            data?.redirectHost
              ? ` 登录后将返回：${data.redirectHost}`
              : ""
          }`
        );
      }
    } catch {
      setMessage("发送失败：当前网络无法连接网站登录服务，请稍后重试。");
      setMessageType("error");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
     <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-8 sm:px-6">
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
           <a href="/points" className="hover:text-white">
            点数明细
          </a>
        </nav>
      </header>

      <div className="flex flex-1 items-center justify-center">
        <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl sm:p-8">
          {accountDeleted && (
            <div className="mb-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              账号及相关数据已永久删除。
            </div>
          )}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300">
              邮箱安全登录
            </div>

            <h1 className="text-3xl font-bold">登录 / 注册</h1>

            <p className="mt-4 text-sm leading-7 text-slate-400">
              无需密码，输入邮箱即可收到安全登录链接。
              新用户首次登录会自动创建账号，并赠送 1000 点测试点数。
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm text-slate-300">
                邮箱地址
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (messageType === "error") {
                    setMessage("");
                    setMessageType("");
                  }
                }}
                autoComplete="email"
                inputMode="email"
                enterKeyHint="send"
                required
                placeholder="请输入你的邮箱"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading || resendSeconds > 0}
              className="w-full rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "发送中..."
                : resendSeconds > 0
                  ? `${resendSeconds} 秒后可重新发送`
                  : sentEmail
                    ? "重新发送登录链接"
                    : "发送登录链接"}
            </button>

            <p className="text-center text-xs leading-5 text-slate-500">
              点击“发送登录链接”即表示你已阅读并同意
              <Link
                href="/terms"
                className="mx-1 text-cyan-300 hover:text-cyan-200"
              >
                《用户协议》
              </Link>
              和
              <Link
                href="/privacy"
                className="mx-1 text-cyan-300 hover:text-cyan-200"
              >
                《隐私政策》
              </Link>
              。
            </p>

            {message && (
              <div
                className={`rounded-2xl border p-4 text-sm leading-6 ${
                  messageType === "success"
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                    : "border-rose-400/30 bg-rose-400/10 text-rose-100"
                }`}
              >
                {message}
              </div>
            )}

            {messageType === "success" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm leading-6 text-slate-300">
                <p className="font-bold text-white">接下来这样操作：</p>
                <ol className="mt-2 space-y-1">
                  <li>1. 打开 {sentEmail} 的收件箱。</li>
                  <li>2. 找到极智岛 AI 登录邮件，垃圾邮件也请检查。</li>
                  <li>3. 点击最新邮件中的链接，浏览器会自动返回网站。</li>
                </ol>
                <p className="mt-3 text-xs text-slate-500">
                  登录链接为一次性链接；重复发送后请使用最新一封邮件。
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-4 text-sm">
              <Link href="/" className="text-slate-400 hover:text-white">
                返回首页
              </Link>
              <span className="text-slate-700">|</span>
              <a href="/chat" className="text-cyan-300 hover:text-cyan-200">
                进入 AI 聊天
              </a>
            </div>

            <p className="text-center text-xs leading-5 text-slate-500">
              当前为测试阶段，请使用真实可收信邮箱登录。登录链接可能会进入垃圾邮件，请注意查看。
              充值前请阅读
              <Link
                href="/refund"
                className="ml-1 text-cyan-300 hover:text-cyan-200"
              >
                充值与退款说明
              </Link>
              。
            </p>
          </form>
        </section>
      </div>
    </section>
  </main>
 );
}

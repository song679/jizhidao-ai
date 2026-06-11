"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin() {
    const userEmail = email.trim();

    if (!userEmail) {
      setMessage("请先输入邮箱。");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: userEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/chat?welcome=1`,
        },
      });

      if (error) {
        setMessage(`发送失败：${error.message}`);
      } else {
        setMessage("登录链接已发送到你的邮箱，请打开邮箱点击链接登录。");
      }
    } catch {
      setMessage(
        "发送失败：当前网络无法连接 Supabase 登录服务，请检查 DNS、代理或网络后重试。"
      );
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
     <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
       <header className="mb-12 flex items-center justify-between border-b border-slate-800 pb-6">
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
        <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
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

          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm text-slate-300">
                邮箱地址
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="请输入你的邮箱"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "发送中..." : "发送登录链接"}
            </button>

            {message && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-300">
                {message}
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
            </p>
          </div>
        </section>
      </div>
    </section>
  </main>
 );
}

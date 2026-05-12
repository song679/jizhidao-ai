"use client";

import { useState } from "react";
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

    const { error } = await supabase.auth.signInWithOtp({
      email: userEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/chat`,
      },
    });

    if (error) {
      setMessage(`发送失败：${error.message}`);
    } else {
      setMessage("登录链接已发送到你的邮箱，请打开邮箱点击链接登录。");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <a href="/" className="mb-10 text-center text-3xl font-bold">
          极智岛 AI
        </a>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
          <h1 className="text-2xl font-bold">登录 / 注册</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            输入邮箱后，我们会发送一个登录链接。新用户首次登录即自动注册。
          </p>

          <div className="mt-8">
            <label className="mb-2 block text-sm text-slate-300">
              邮箱地址
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="请输入你的邮箱"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="mt-5 w-full rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "发送中..." : "发送登录链接"}
          </button>

          {message && (
            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-300">
              {message}
            </div>
          )}

          <p className="mt-6 text-xs leading-5 text-slate-500">
            目前为测试阶段。请使用真实可收信邮箱登录。
          </p>
        </section>
      </div>
    </main>
  );
}
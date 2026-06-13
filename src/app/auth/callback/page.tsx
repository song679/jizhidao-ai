"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

function getSafeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/chat?welcome=1";
}

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("正在完成登录，请稍候...");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function completeLogin() {
      const url = new URL(window.location.href);
      const nextPath = getSafeNextPath(url.searchParams.get("next"));
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const authError =
        url.searchParams.get("error_description") ||
        hashParams.get("error_description");

      if (authError) {
        throw new Error(decodeURIComponent(authError.replace(/\+/g, " ")));
      }

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const code = url.searchParams.get("code");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) throw error;
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) throw error;
      } else {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error || !session) {
          throw error || new Error("登录链接无效或已经过期");
        }
      }

      if (active) {
        window.location.replace(nextPath);
      }
    }

    completeLogin().catch((error) => {
      console.error("完成邮箱登录失败：", error);

      if (active) {
        setFailed(true);
        setMessage(
          error instanceof Error
            ? `登录失败：${error.message}`
            : "登录链接无效或已经过期，请重新发送登录邮件。"
        );
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-8 text-white">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-center shadow-2xl sm:p-8">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
            failed
              ? "bg-rose-400/10 text-rose-300"
              : "bg-cyan-400/10 text-cyan-300"
          }`}
        >
          {failed ? "!" : "✓"}
        </div>
        <h1 className="mt-5 text-2xl font-bold">
          {failed ? "无法完成登录" : "正在安全登录"}
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">{message}</p>

        {!failed && (
          <p className="mt-4 text-xs leading-5 text-slate-500">
            请不要重复点击登录邮件；验证完成后页面会自动进入 AI 聊天。
          </p>
        )}

        {failed && (
          <div className="mt-6 grid gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300"
            >
              重新发送登录链接
            </Link>
            <Link
              href="/support"
              className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300"
            >
              仍然无法登录，获取帮助
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

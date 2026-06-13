"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";

function createErrorCode(prefix: string, error: Error) {
  const source = `${error.name}:${error.message}`;
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return `${prefix}-${hash.toString(36).toUpperCase().padStart(6, "0")}`;
}

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const errorCode = useMemo(
    () => error.digest || createErrorCode("WEB", error),
    [error]
  );

  useEffect(() => {
    console.error("页面运行异常：", {
      code: errorCode,
      name: error.name,
      message: error.message,
      digest: error.digest,
    });
  }, [error, errorCode]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <section
        className="w-full max-w-xl rounded-3xl border border-rose-400/30 bg-slate-900/70 p-8 text-center md:p-12"
        aria-live="polite"
      >
        <p className="text-sm font-semibold text-rose-300">页面暂时无法正常显示</p>
        <h1 className="mt-4 text-3xl font-bold">当前出现内部技术问题</h1>
        <p className="mt-4 text-sm leading-7 text-slate-400">
          请先尝试重新加载。如果问题持续出现，可以把发生时间和页面截图发送给管理员。
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300"
          >
            重新加载
          </button>
          <Link
            href={`/support?error=${encodeURIComponent(errorCode)}`}
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold hover:border-cyan-400/60 hover:text-cyan-300"
          >
            联系管理员
          </Link>
          <Link
            href="/chat"
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:text-white"
          >
            返回 AI 聊天
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:text-white"
          >
            返回首页
          </Link>
        </div>
        <p className="mt-6 text-xs text-slate-500">
          故障编号：<span className="font-mono text-slate-400">{errorCode}</span>
        </p>
      </section>
    </main>
  );
}

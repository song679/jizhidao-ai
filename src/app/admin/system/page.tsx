"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type CheckStatus = "ok" | "warning" | "error";

type SystemData = {
  generatedAt: string;
  adminEmail: string;
  overallStatus: CheckStatus;
  deployment: {
    environment: string;
    region: string;
    siteUrl: string;
    commit: string;
  };
  environment: Array<{
    name: string;
    configured: boolean;
    required: boolean;
  }>;
  checks: Array<{
    id: string;
    label: string;
    status: CheckStatus;
    detail: string;
  }>;
};

const statusLabels: Record<CheckStatus, string> = {
  ok: "正常",
  warning: "需关注",
  error: "异常",
};

const statusClasses: Record<CheckStatus, string> = {
  ok: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  error: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

export default function AdminSystemPage() {
  const [data, setData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadSystem = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.assign("/login");
        return;
      }

      const response = await fetch("/api/admin/system", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(responseData?.error || "系统检查失败");
      }

      setData(responseData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "系统检查失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSystem(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSystem]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <Link href="/" className="text-2xl font-bold">
            极智岛 AI
          </Link>
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/admin"
              className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:text-cyan-300"
            >
              运营概览
            </Link>
            <Link
              href="/admin/orders"
              className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:text-cyan-300"
            >
              充值订单
            </Link>
            <Link
              href="/chat"
              className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:text-cyan-300"
            >
              返回聊天
            </Link>
          </nav>
        </header>

        <section className="py-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-cyan-300">管理员工具</p>
              <h1 className="mt-2 text-3xl font-bold">系统状态</h1>
              <p className="mt-2 text-sm text-slate-400">
                检查生产环境配置、数据库表和关键函数，不显示任何密钥内容。
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadSystem()}
              disabled={loading}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 disabled:opacity-50"
            >
              {loading ? "检查中…" : "重新检查"}
            </button>
          </div>
        </section>

        {message && (
          <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {message}
          </div>
        )}

        {data && (
          <>
            <section
              className={`rounded-2xl border p-5 ${statusClasses[data.overallStatus]}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold">
                    系统状态：{statusLabels[data.overallStatus]}
                  </p>
                  <p className="mt-2 text-xs opacity-80">
                    管理员：{data.adminEmail}
                  </p>
                </div>
                <p className="text-xs opacity-80">
                  {new Date(data.generatedAt).toLocaleString("zh-CN", {
                    hour12: false,
                  })}
                </p>
              </div>
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["部署环境", data.deployment.environment],
                ["Vercel 区域", data.deployment.region],
                ["Git 提交", data.deployment.commit],
                ["生产域名", data.deployment.siteUrl],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                >
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-2 break-all text-sm font-semibold text-slate-200">
                    {value}
                  </p>
                </div>
              ))}
            </section>

            <section className="mt-8">
              <h2 className="text-xl font-bold">环境变量</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.environment.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-slate-300">
                        {item.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {item.required ? "必需" : "可选"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        item.configured
                          ? statusClasses.ok
                          : item.required
                            ? statusClasses.error
                            : statusClasses.warning
                      }`}
                    >
                      {item.configured ? "已配置" : "未配置"}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="text-xl font-bold">数据库与关键函数</h2>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
                {data.checks.map((check) => (
                  <div
                    key={check.id}
                    className="grid gap-3 border-b border-slate-800 bg-slate-900/50 p-4 last:border-b-0 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="font-semibold">{check.label}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {check.detail}
                      </p>
                    </div>
                    <span
                      className={`h-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses[check.status]}`}
                    >
                      {statusLabels[check.status]}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5 text-sm leading-7 text-slate-300">
              <h2 className="font-bold text-cyan-200">故障处理建议</h2>
              <p className="mt-2">
                环境变量异常：在 Vercel Environment Variables 修正后重新部署。
                数据库或函数异常：按仓库中的 `OPERATIONS.md` 和
                `supabase/migrations` 文件处理。
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

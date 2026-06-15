"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type PaymentEvent = {
  id: string;
  provider: string;
  event_id: string;
  event_type: string | null;
  order_no: string | null;
  signature_valid: boolean;
  processing_status: string;
  payload_digest: string | null;
  error_code: string | null;
  received_at: string;
  processed_at: string | null;
};

type Summary = {
  received: number;
  processed: number;
  ignored: number;
  failed: number;
};

const PAGE_SIZE = 20;
const statusLabels: Record<string, string> = {
  received: "待处理",
  processed: "已完成",
  ignored: "已忽略",
  failed: "处理失败",
};
const statusClasses: Record<string, string> = {
  received: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  processed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  ignored: "border-slate-600 bg-slate-800 text-slate-300",
  failed: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
    timeZone: "Asia/Shanghai",
  });
}

export default function AdminPaymentsPage() {
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [summary, setSummary] = useState<Summary>({
    received: 0,
    processed: 0,
    ignored: 0,
    failed: 0,
  });
  const [status, setStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadEvents = useCallback(
    async (
      nextStatus = status,
      nextPage = page,
      nextSearch = search,
      silent = false
    ) => {
      if (!silent) {
        setLoading(true);
        setMessage("");
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          window.location.assign("/login");
          return;
        }

        const params = new URLSearchParams({
          status: nextStatus,
          page: String(nextPage),
          pageSize: String(PAGE_SIZE),
        });

        if (nextSearch) params.set("search", nextSearch);

        const response = await fetch(
          `/api/admin/payment-events?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error || "加载支付回调事件失败");
        }

        setReady(data.ready !== false);
        setEvents(Array.isArray(data.events) ? data.events : []);
        setSummary(data.summary || summary);
        setTotal(typeof data.total === "number" ? data.total : 0);
        setPage(typeof data.page === "number" ? data.page : nextPage);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "加载支付回调事件失败"
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [page, search, status, summary]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEvents("all", 1, ""), 0);
    return () => window.clearTimeout(timer);
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadEvents(status, page, search, true);
      }
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [loadEvents, page, search, status]);

  function applySearch(event: FormEvent) {
    event.preventDefault();
    const nextSearch = searchInput.trim();
    setSearch(nextSearch);
    setPage(1);
    void loadEvents(status, 1, nextSearch);
  }

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
              href="/admin/system"
              className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:text-cyan-300"
            >
              系统状态
            </Link>
            <Link
              href="/chat"
              className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:text-cyan-300"
            >
              返回聊天
            </Link>
          </nav>
        </header>

        <section className="flex flex-wrap items-end justify-between gap-4 py-8">
          <div>
            <p className="text-sm font-semibold text-cyan-300">管理员工具</p>
            <h1 className="mt-2 text-3xl font-bold">支付回调监控</h1>
            <p className="mt-3 text-sm text-slate-400">
              查看支付平台回调的验签、去重与到账处理结果，不展示原始支付报文。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadEvents()}
            disabled={loading}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 disabled:opacity-50"
          >
            {loading ? "刷新中…" : "刷新数据"}
          </button>
        </section>

        {!ready && (
          <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            支付回调数据库尚未初始化，请执行
            `20260615_payment_webhook_safety.sql`。
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
            {message}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(statusLabels).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setStatus(key);
                setPage(1);
                void loadEvents(key, 1, search);
              }}
              className={`rounded-xl border p-4 text-left ${
                status === key
                  ? statusClasses[key]
                  : "border-slate-800 bg-slate-900/60 text-slate-300"
              }`}
            >
              <p className="text-sm">{label}</p>
              <p className="mt-2 text-2xl font-bold">{summary[key as keyof Summary]}</p>
            </button>
          ))}
        </section>

        <section className="mt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setStatus("all");
                  setPage(1);
                  void loadEvents("all", 1, search);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  status === "all"
                    ? "bg-cyan-400 text-slate-950"
                    : "border border-slate-700 text-slate-300"
                }`}
              >
                全部事件
              </button>
              {Object.entries(statusLabels).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setStatus(key);
                    setPage(1);
                    void loadEvents(key, 1, search);
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    status === key
                      ? "bg-cyan-400 text-slate-950"
                      : "border border-slate-700 text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={applySearch} className="flex w-full max-w-md gap-2">
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="搜索订单号、事件 ID 或支付渠道"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-400"
              />
              <button
                type="submit"
                className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950"
              >
                搜索
              </button>
            </form>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
            <div className="hidden grid-cols-[1fr_1.2fr_1fr_0.8fr_1fr] gap-4 bg-slate-900 px-5 py-3 text-xs font-semibold text-slate-400 lg:grid">
              <span>支付渠道 / 事件</span>
              <span>订单</span>
              <span>状态</span>
              <span>验签</span>
              <span>接收时间</span>
            </div>

            {loading ? (
              <p className="px-5 py-12 text-center text-sm text-slate-500">
                正在加载支付回调事件…
              </p>
            ) : events.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-slate-500">
                当前筛选条件下没有支付回调事件。
              </p>
            ) : (
              events.map((item) => (
                <article
                  key={item.id}
                  className="grid gap-4 border-t border-slate-800 px-5 py-4 first:border-t-0 lg:grid-cols-[1fr_1.2fr_1fr_0.8fr_1fr]"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{item.provider}</p>
                    <p className="mt-1 break-all text-xs text-slate-500">
                      {item.event_id}
                    </p>
                    {item.event_type && (
                      <p className="mt-1 text-xs text-slate-400">
                        {item.event_type}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-slate-200">
                      {item.order_no || "未关联订单"}
                    </p>
                    {item.error_code && (
                      <p className="mt-1 break-all text-xs text-rose-300">
                        {item.error_code}
                      </p>
                    )}
                    {item.payload_digest && (
                      <p className="mt-1 truncate text-xs text-slate-600">
                        摘要：{item.payload_digest}
                      </p>
                    )}
                  </div>
                  <div>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                        statusClasses[item.processing_status] ||
                        statusClasses.ignored
                      }`}
                    >
                      {statusLabels[item.processing_status] ||
                        item.processing_status}
                    </span>
                    <p className="mt-2 text-xs text-slate-500">
                      完成：{formatDate(item.processed_at)}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      item.signature_valid
                        ? "text-emerald-300"
                        : "text-rose-300"
                    }`}
                  >
                    {item.signature_valid ? "已通过" : "未通过"}
                  </p>
                  <p className="text-sm text-slate-400">
                    {formatDate(item.received_at)}
                  </p>
                </article>
              ))
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 text-sm text-slate-400">
            <span>
              共 {total} 条，第 {page}/{totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => {
                  const nextPage = page - 1;
                  setPage(nextPage);
                  void loadEvents(status, nextPage, search);
                }}
                className="rounded-lg border border-slate-700 px-4 py-2 disabled:opacity-40"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  void loadEvents(status, nextPage, search);
                }}
                className="rounded-lg border border-slate-700 px-4 py-2 disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}


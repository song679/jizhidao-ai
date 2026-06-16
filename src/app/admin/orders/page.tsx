"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatPlanPrice } from "@/lib/recharge-plans";

type Order = {
  id: string;
  order_no: string;
  email: string;
  plan_name: string;
  amount_cents: number;
  points: number;
  status: string;
  payment_channel: string | null;
  payment_reference: string | null;
  admin_email: string | null;
  note: string | null;
  created_at: string;
  paid_at: string | null;
  updated_at: string;
};

const statusLabels: Record<string, string> = {
  pending: "待确认",
  paid: "已到账",
  cancelled: "已取消",
  refunded: "已退款",
};

const statusClasses: Record<string, string> = {
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  paid: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  cancelled: "border-slate-600 bg-slate-800 text-slate-300",
  refunded: "border-violet-400/30 bg-violet-400/10 text-violet-200",
};

const PAGE_SIZE = 20;

const paymentChannelLabels: Record<string, string> = {
  manual: "人工收款",
  wechat: "微信",
  alipay: "支付宝",
  bank: "银行转账",
};

function getOrderStatusLabel(order: Order) {
  if (
    order.status === "cancelled" &&
    order.note?.includes("超过有效期")
  ) {
    return "已过期";
  }

  return statusLabels[order.status] || order.status;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false,
  });
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("pending");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentChannel, setPaymentChannel] = useState("wechat");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function loadOrders(
    nextStatus = status,
    nextPage = page,
    nextSearch = search,
    silent = false
  ) {
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

      if (nextSearch) {
        params.set("search", nextSearch);
      }

      const response = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "加载充值订单失败");
      }

      setReady(data.ready !== false);
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setPage(typeof data.page === "number" ? data.page : nextPage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载充值订单失败");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => loadOrders("pending"), 0);
    return () => window.clearTimeout(timer);
    // Initial admin order load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !processingId &&
        !paymentOrder
      ) {
        void loadOrders(status, page, search, true);
      }
    }, 30_000);

    return () => window.clearInterval(interval);
    // Poll using the current filters without interrupting admin operations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, search, processingId, paymentOrder]);

  useEffect(() => {
    document.title =
      status === "pending" && total > 0
        ? `(${total}) 待处理充值订单 - 极智岛 AI`
        : "充值订单管理 - 极智岛 AI";

    return () => {
      document.title = "极智岛 AI";
    };
  }, [status, total]);

  async function updateOrder(
    order: Order,
    action: "complete" | "cancel",
    payment?: {
      channel: string;
      reference: string;
      note: string;
    }
  ) {
    setProcessingId(order.id);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.assign("/login");
        return;
      }

      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
          action,
          paymentChannel: payment?.channel || "manual",
          paymentReference: payment?.reference || "",
          note: payment?.note || "管理员取消订单",
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "处理订单失败");
      }

      setMessage(
        action === "complete"
          ? `订单 ${order.order_no} 已到账，点数已自动增加。`
          : `订单 ${order.order_no} 已取消。`
      );
      setSelectedOrder(null);
      setPaymentOrder(null);
      setPaymentReference("");
      setPaymentNote("");
      await loadOrders(status, page, search);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "处理订单失败");
    } finally {
      setProcessingId(null);
    }
  }

  async function exportOrders() {
    setExporting(true);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.assign("/login");
        return;
      }

      const params = new URLSearchParams({
        status,
        format: "csv",
      });

      if (search) {
        params.set("search", search);
      }

      const response = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Export recharge orders failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `recharge-orders-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export recharge orders failed");
    } finally {
      setExporting(false);
    }
  }

  function openPaymentDialog(order: Order) {
    setPaymentOrder(order);
    setPaymentChannel("wechat");
    setPaymentReference("");
    setPaymentNote("");
  }

  function cancelOrder(order: Order) {
    if (!window.confirm(`确定取消订单 ${order.order_no} 吗？`)) return;
    void updateOrder(order, "cancel");
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
              href="/admin/recharge"
              className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:text-cyan-300"
            >
              点数管理
            </Link>
            <Link
              href="/admin/payments"
              className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:text-cyan-300"
            >
              支付监控
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
          <p className="text-sm font-semibold text-cyan-300">管理员工具</p>
          <h1 className="mt-2 text-3xl font-bold">充值订单</h1>
          <p className="mt-3 text-sm text-slate-400">
            确认收款后，系统会原子更新订单、用户余额和点数流水。
          </p>
        </section>

        {!ready && (
          <div className="mb-6 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-4 text-sm text-amber-100">
            订单数据库尚未初始化，请先在 Supabase SQL Editor 执行
            `20260612_recharge_orders.sql`。
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {message}
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {["pending", "paid", "cancelled", "refunded", "all"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setStatus(item);
                  setPage(1);
                  loadOrders(item, 1, search);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  status === item
                    ? "bg-cyan-400 text-slate-950"
                    : "border border-slate-700 text-slate-300"
                }`}
              >
                {item === "all" ? "全部订单" : statusLabels[item]}
              </button>
            ))}
          </div>

          <form
            className="flex w-full max-w-md gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const nextSearch = searchInput.trim();
              setSearch(nextSearch);
              setPage(1);
              loadOrders(status, 1, nextSearch);
            }}
          >
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="搜索订单号或用户邮箱"
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"
            >
              搜索
            </button>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setPage(1);
                  loadOrders(status, 1, "");
                }}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300"
              >
                清除
              </button>
            )}
          </form>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
          <span>
            {loading ? "正在加载订单…" : `共 ${total} 条订单`}
            {search ? `，搜索“${search}”` : ""}
            {!loading ? " · 每 30 秒自动刷新" : ""}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportOrders()}
              disabled={exporting || !ready}
              className="rounded-lg border border-cyan-400/40 px-4 py-2 text-cyan-200 disabled:opacity-50"
            >
              {exporting ? "导出中…" : "导出 CSV"}
            </button>
            <button
              type="button"
              onClick={() => loadOrders(status, page, search)}
              disabled={loading}
              className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 disabled:opacity-50"
            >
              刷新
            </button>
          </div>
        </div>

        <section className="mt-6 space-y-4 md:hidden">
          {orders.map((order) => (
            <article
              key={order.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">{order.plan_name}</p>
                  <p className="mt-1 truncate text-sm text-slate-400">
                    {order.email}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                    statusClasses[order.status] || statusClasses.cancelled
                  }`}
                >
                  {getOrderStatusLabel(order)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-950/70 p-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">支付金额</p>
                  <p className="mt-1 font-bold">
                    ¥{formatPlanPrice(order.amount_cents)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">到账点数</p>
                  <p className="mt-1 font-bold text-cyan-300">
                    {order.points.toLocaleString()} 点
                  </p>
                </div>
              </div>

              <p className="mt-4 break-all font-mono text-xs text-slate-500">
                {order.order_no}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {formatDate(order.created_at)}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-300"
                >
                  查看详情
                </button>
                {order.status === "pending" ? (
                  <button
                    type="button"
                    onClick={() => openPaymentDialog(order)}
                    disabled={processingId === order.id}
                    className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
                  >
                    确认到账
                  </button>
                ) : (
                  <div />
                )}
              </div>

              {order.status === "pending" && (
                <button
                  type="button"
                  onClick={() => cancelOrder(order)}
                  disabled={processingId === order.id}
                  className="mt-3 w-full rounded-xl border border-rose-400/40 px-4 py-3 text-sm text-rose-300 disabled:opacity-50"
                >
                  取消此订单
                </button>
              )}
            </article>
          ))}

          {!loading && orders.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-12 text-center text-sm text-slate-400">
              当前筛选条件下没有订单。
            </div>
          )}
        </section>

        <section className="mt-6 hidden overflow-x-auto rounded-lg border border-slate-800 md:block">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-900 text-xs text-slate-400">
              <tr>
                <th className="px-4 py-3">订单</th>
                <th className="px-4 py-3">用户</th>
                <th className="px-4 py-3">套餐</th>
                <th className="px-4 py-3 text-right">金额</th>
                <th className="px-4 py-3 text-right">点数</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">时间</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-4 font-mono text-xs">
                    {order.order_no}
                  </td>
                  <td className="max-w-52 truncate px-4 py-4">
                    {order.email}
                  </td>
                  <td className="px-4 py-4">{order.plan_name}</td>
                  <td className="px-4 py-4 text-right">
                    ¥{formatPlanPrice(order.amount_cents)}
                  </td>
                  <td className="px-4 py-4 text-right text-cyan-300">
                    {order.points.toLocaleString()}
                  </td>
                  <td className="px-4 py-4">
                    {getOrderStatusLabel(order)}
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-500">
                    {formatDate(order.created_at)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300"
                      >
                        详情
                      </button>
                      {order.status === "pending" && (
                        <>
                        <button
                          type="button"
                          onClick={() => openPaymentDialog(order)}
                          disabled={processingId === order.id}
                          className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
                        >
                          确认到账
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelOrder(order)}
                          disabled={processingId === order.id}
                          className="rounded-lg border border-rose-400/40 px-3 py-2 text-xs text-rose-300 disabled:opacity-50"
                        >
                          取消
                        </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && orders.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    当前筛选条件下没有订单。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {total > 0 && (
          <div className="mt-5 flex items-center justify-between gap-4 text-sm">
            <span className="text-slate-400">
              第 {page} / {totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => loadOrders(status, page - 1, search)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={loading || page >= totalPages}
                onClick={() => loadOrders(status, page + 1, search)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-detail-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedOrder(null);
          }}
        >
          <section className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-cyan-300">订单详情</p>
                <h2 id="order-detail-title" className="mt-1 font-mono text-lg font-bold">
                  {selectedOrder.order_no}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300"
              >
                关闭
              </button>
            </div>

            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              {[
                ["用户邮箱", selectedOrder.email],
                ["订单状态", getOrderStatusLabel(selectedOrder)],
                ["套餐", selectedOrder.plan_name],
                ["支付金额", `¥${formatPlanPrice(selectedOrder.amount_cents)}`],
                ["充值点数", `${selectedOrder.points.toLocaleString()} 点`],
                [
                  "支付渠道",
                  selectedOrder.payment_channel
                    ? paymentChannelLabels[selectedOrder.payment_channel] ||
                      selectedOrder.payment_channel
                    : "—",
                ],
                ["支付流水号", selectedOrder.payment_reference || "—"],
                ["处理管理员", selectedOrder.admin_email || "—"],
                ["创建时间", formatDate(selectedOrder.created_at)],
                ["到账时间", formatDate(selectedOrder.paid_at)],
                ["最后更新", formatDate(selectedOrder.updated_at)],
                ["备注", selectedOrder.note || "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-950/70 p-4">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-2 break-words text-slate-100">{value}</dd>
                </div>
              ))}
            </dl>

            {selectedOrder.status === "pending" && (
              <button
                type="button"
                onClick={() => {
                  setSelectedOrder(null);
                  openPaymentDialog(selectedOrder);
                }}
                className="mt-6 w-full rounded-xl bg-cyan-400 px-4 py-3 font-bold text-slate-950"
              >
                填写收款信息并确认到账
              </button>
            )}
          </section>
        </div>
      )}

      {paymentOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-dialog-title"
        >
          <form
            className="max-h-full w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              void updateOrder(paymentOrder, "complete", {
                channel: paymentChannel,
                reference: paymentReference.trim(),
                note: paymentNote.trim() || "管理员确认收款",
              });
            }}
          >
            <p className="text-sm font-semibold text-cyan-300">确认收款</p>
            <h2 id="payment-dialog-title" className="mt-1 text-2xl font-bold">
              为用户充值 {paymentOrder.points.toLocaleString()} 点
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {paymentOrder.email} · ¥{formatPlanPrice(paymentOrder.amount_cents)}
            </p>

            <div className="mt-6 space-y-5">
              <label className="block text-sm">
                <span className="mb-2 block text-slate-300">支付渠道</span>
                <select
                  value={paymentChannel}
                  onChange={(event) => setPaymentChannel(event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
                >
                  <option value="wechat">微信</option>
                  <option value="alipay">支付宝</option>
                  <option value="bank">银行转账</option>
                  <option value="manual">其他人工收款</option>
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-2 block text-slate-300">
                  支付流水号（选填）
                </span>
                <input
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  maxLength={100}
                  placeholder="填写微信、支付宝或银行交易单号"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-2 block text-slate-300">管理员备注（选填）</span>
                <textarea
                  value={paymentNote}
                  onChange={(event) => setPaymentNote(event.target.value)}
                  maxLength={200}
                  rows={3}
                  placeholder="例如：已核对微信收款记录"
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={processingId === paymentOrder.id}
                onClick={() => setPaymentOrder(null)}
                className="rounded-xl border border-slate-700 px-5 py-3 text-slate-300 disabled:opacity-50"
              >
                返回
              </button>
              <button
                type="submit"
                disabled={processingId === paymentOrder.id}
                className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-50"
              >
                {processingId === paymentOrder.id
                  ? "正在处理…"
                  : "确认到账并增加点数"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

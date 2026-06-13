"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatPlanPrice } from "@/lib/recharge-plans";

type Order = {
  id: string;
  order_no: string;
  plan_name: string;
  amount_cents: number;
  points: number;
  status: string;
  payment_channel: string | null;
  payment_reference: string | null;
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

const paymentChannelLabels: Record<string, string> = {
  manual: "人工收款",
  wechat: "微信",
  alipay: "支付宝",
  bank: "银行转账",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

export default function OrdersPage() {
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const loadOrders = useCallback(async () => {
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

      setEmail(session.user.email || "");
      const response = await fetch("/api/orders", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "加载订单失败");
      }

      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载订单失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrders(), 0);
    return () => window.clearTimeout(timer);
  }, [loadOrders]);

  async function cancelOrder(order: Order) {
    if (!window.confirm(`确定取消订单 ${order.order_no} 吗？`)) return;

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

      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: order.id,
          action: "cancel",
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "取消订单失败");
      }

      setMessage(`订单 ${order.order_no} 已取消。`);
      setSelectedOrder(null);
      await loadOrders();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "取消订单失败");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-5 py-8 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <Link href="/" className="text-2xl font-bold">
            极智岛 AI
          </Link>
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/pricing"
              className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:text-cyan-300"
            >
              充值点数
            </Link>
            <Link
              href="/points"
              className="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:text-cyan-300"
            >
              点数明细
            </Link>
            <Link
              href="/chat"
              className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950"
            >
              返回聊天
            </Link>
          </nav>
        </header>

        <section className="py-10">
          <p className="text-sm font-semibold text-cyan-300">账户订单</p>
          <h1 className="mt-2 text-4xl font-bold">我的充值订单</h1>
          <p className="mt-3 text-sm text-slate-400">
            当前账号：{email || "加载中…"}
          </p>
        </section>

        {message && (
          <div className="mb-6 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {message}
          </div>
        )}

        <div className="mb-5 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-400">
            {loading ? "正在加载…" : `共 ${orders.length} 条订单`}
          </p>
          <button
            type="button"
            onClick={() => void loadOrders()}
            disabled={loading}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 disabled:opacity-50"
          >
            刷新状态
          </button>
        </div>

        <section className="space-y-4">
          {!loading && orders.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-12 text-center">
              <p className="text-slate-400">当前还没有充值订单。</p>
              <Link
                href="/pricing"
                className="mt-5 inline-block rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950"
              >
                选择充值套餐
              </Link>
            </div>
          )}

          {orders.map((order) => (
            <article
              key={order.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-bold">{order.plan_name}</h2>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        statusClasses[order.status] || statusClasses.cancelled
                      }`}
                    >
                      {statusLabels[order.status] || order.status}
                    </span>
                  </div>
                  <p className="mt-2 break-all font-mono text-xs text-slate-500">
                    {order.order_no}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    创建于 {formatDate(order.created_at)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <div className="mr-2">
                    <p className="text-xl font-bold text-cyan-300">
                      ¥{formatPlanPrice(order.amount_cents)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {order.points.toLocaleString()} 点
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(order)}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
                  >
                    查看详情
                  </button>
                  {order.status === "pending" && (
                    <button
                      type="button"
                      disabled={processingId === order.id}
                      onClick={() => void cancelOrder(order)}
                      className="rounded-lg border border-rose-400/40 px-4 py-2 text-sm text-rose-300 disabled:opacity-50"
                    >
                      取消订单
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>

      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-order-detail-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedOrder(null);
          }}
        >
          <section className="max-h-full w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-cyan-300">订单详情</p>
                <h2
                  id="user-order-detail-title"
                  className="mt-1 break-all font-mono text-base font-bold"
                >
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
                ["套餐", selectedOrder.plan_name],
                ["订单状态", statusLabels[selectedOrder.status] || selectedOrder.status],
                ["支付金额", `¥${formatPlanPrice(selectedOrder.amount_cents)}`],
                ["到账点数", `${selectedOrder.points.toLocaleString()} 点`],
                [
                  "支付渠道",
                  selectedOrder.payment_channel
                    ? paymentChannelLabels[selectedOrder.payment_channel] ||
                      selectedOrder.payment_channel
                    : "待管理员确认",
                ],
                ["支付流水号", selectedOrder.payment_reference || "—"],
                ["创建时间", formatDate(selectedOrder.created_at)],
                ["到账时间", formatDate(selectedOrder.paid_at)],
                ["最后更新", formatDate(selectedOrder.updated_at)],
                ["订单备注", selectedOrder.note || "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-950/70 p-4">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-2 break-words text-slate-100">{value}</dd>
                </div>
              ))}
            </dl>

            {selectedOrder.status === "pending" && (
              <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
                订单正在等待管理员核对收款。若尚未付款或不再需要，可以取消订单。
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

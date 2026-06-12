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
};

const statusLabels: Record<string, string> = {
  pending: "待确认",
  paid: "已到账",
  cancelled: "已取消",
  refunded: "已退款",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(true);

  async function loadOrders(nextStatus = status) {
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

      const response = await fetch(
        `/api/admin/orders?status=${encodeURIComponent(nextStatus)}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "加载充值订单失败");
      }

      setReady(data.ready !== false);
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载充值订单失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => loadOrders("pending"), 0);
    return () => window.clearTimeout(timer);
    // Initial admin order load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateOrder(order: Order, action: "complete" | "cancel") {
    const confirmed = window.confirm(
      action === "complete"
        ? `确认订单 ${order.order_no} 已收款，并为 ${order.email} 增加 ${order.points} 点吗？`
        : `确定取消订单 ${order.order_no} 吗？`
    );

    if (!confirmed) return;

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
          paymentChannel: "manual",
          note:
            action === "complete"
              ? "管理员确认线下收款"
              : "管理员取消订单",
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
      await loadOrders(status);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "处理订单失败");
    } finally {
      setProcessingId(null);
    }
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

        <div className="flex flex-wrap gap-2">
          {["pending", "paid", "cancelled", "all"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setStatus(item);
                loadOrders(item);
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

        <section className="mt-6 overflow-x-auto rounded-lg border border-slate-800">
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
                    {statusLabels[order.status] || order.status}
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-500">
                    {new Date(order.created_at).toLocaleString("zh-CN", {
                      hour12: false,
                    })}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {order.status === "pending" && (
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => updateOrder(order, "complete")}
                          disabled={processingId === order.id}
                          className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
                        >
                          确认到账
                        </button>
                        <button
                          type="button"
                          onClick={() => updateOrder(order, "cancel")}
                          disabled={processingId === order.id}
                          className="rounded-lg border border-rose-400/40 px-3 py-2 text-xs text-rose-300 disabled:opacity-50"
                        >
                          取消
                        </button>
                      </div>
                    )}
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
      </div>
    </main>
  );
}

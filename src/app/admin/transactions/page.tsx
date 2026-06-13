"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { parsePointDescription } from "@/lib/point-description";

type PointTransaction = {
  id: string;
  email: string;
  change_amount: number;
  balance_after: number;
  type: string;
  description: string | null;
  created_at: string;
};

type TransactionFilters = {
  email: string;
  type: string;
  fromDate: string;
  toDate: string;
};

const transactionTypes = [
  { value: "", label: "全部类型" },
  { value: "chat", label: "AI 聊天" },
  { value: "recharge", label: "充值" },
  { value: "deduction", label: "管理员扣减" },
  { value: "refund", label: "失败退还" },
  { value: "gift", label: "赠送" },
];

const transactionLabels = Object.fromEntries(
  transactionTypes
    .filter((item) => item.value)
    .map((item) => [item.value, item.label])
);

export default function AdminTransactionsPage() {
  const [adminEmail, setAdminEmail] = useState("");
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [email, setEmail] = useState("");
  const [type, setType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.assign("/login");
      return null;
    }

    return session.access_token;
  }

  function createParams(
    nextPage = page,
    filters: TransactionFilters = { email, type, fromDate, toDate }
  ) {
    const params = new URLSearchParams({ page: String(nextPage) });

    if (filters.email.trim()) params.set("email", filters.email.trim());
    if (filters.type) params.set("type", filters.type);
    if (filters.fromDate) params.set("from", filters.fromDate);
    if (filters.toDate) params.set("to", filters.toDate);

    return params;
  }

  async function loadTransactions(
    nextPage = 1,
    filters?: TransactionFilters
  ) {
    setLoading(true);
    setMessage("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) return;

      const response = await fetch(
        `/api/admin/transactions?${createParams(
          nextPage,
          filters
        ).toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "加载点数流水失败");
      }

      setAdminEmail(data.adminEmail || "");
      setTransactions(
        Array.isArray(data.transactions) ? data.transactions : []
      );
      setTotal(typeof data.total === "number" ? data.total : 0);
      setPage(typeof data.page === "number" ? data.page : nextPage);
      setPageSize(typeof data.pageSize === "number" ? data.pageSize : 50);
    } catch (error) {
      console.error("加载点数流水失败：", error);
      setMessage(error instanceof Error ? error.message : "加载点数流水失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => loadTransactions(1), 0);
    return () => window.clearTimeout(timer);
    // Initial administrator check and transaction load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadTransactions(1);
  }

  function clearFilters() {
    const emptyFilters = {
      email: "",
      type: "",
      fromDate: "",
      toDate: "",
    };

    setEmail("");
    setType("");
    setFromDate("");
    setToDate("");
    loadTransactions(1, emptyFilters);
  }

  async function exportTransactions() {
    setExporting(true);
    setMessage("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) return;

      const params = createParams(1);
      params.set("format", "csv");
      const response = await fetch(
        `/api/admin/transactions?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "导出点数流水失败");
      }

      const blob = await response.blob();
      const filenameMatch = response.headers
        .get("content-disposition")
        ?.match(/filename="([^"]+)"/);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download =
        filenameMatch?.[1] ||
        `point-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("导出点数流水失败：", error);
      setMessage(error instanceof Error ? error.message : "导出点数流水失败");
    } finally {
      setExporting(false);
    }
  }

  function formatTime(value: string) {
    return new Date(value).toLocaleString("zh-CN", {
      hour12: false,
      timeZone: "Asia/Shanghai",
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <Link href="/" className="text-2xl font-bold">
            极智岛 AI
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href="/admin"
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:text-cyan-300"
            >
              运营概览
            </Link>
            <Link
              href="/admin/users"
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:text-cyan-300"
            >
              用户管理
            </Link>
            <Link
              href="/admin/recharge"
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:text-cyan-300"
            >
              点数管理
            </Link>
          </nav>
        </header>

        <section className="py-8">
          <p className="text-sm font-semibold text-cyan-300">管理员工具</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">点数流水</h1>
              <p className="mt-2 text-sm text-slate-400">
                当前管理员：{adminEmail || "正在验证权限..."}
              </p>
            </div>
            <button
              type="button"
              onClick={exportTransactions}
              disabled={exporting || loading}
              className="rounded-lg bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
            >
              {exporting ? "正在导出..." : "导出当前筛选 CSV"}
            </button>
          </div>
        </section>

        <form
          onSubmit={handleFilter}
          className="grid gap-4 border-y border-slate-800 py-5 md:grid-cols-2 xl:grid-cols-[1.4fr_0.8fr_1fr_1fr_auto]"
        >
          <input
            type="search"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="按用户邮箱筛选"
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-400"
          />
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-cyan-400"
          >
            {transactionTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <label className="grid grid-cols-[auto_1fr] items-center gap-2 text-xs text-slate-400">
            从
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400"
            />
          </label>
          <label className="grid grid-cols-[auto_1fr] items-center gap-2 text-xs text-slate-400">
            到
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg border border-cyan-400/50 px-5 py-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10 disabled:opacity-50"
            >
              筛选
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-slate-700 px-4 py-3 text-sm text-slate-400 hover:text-white"
            >
              清除
            </button>
          </div>
        </form>

        {message && (
          <div className="mt-5 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {message}
          </div>
        )}

        <section className="py-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-400">
              共 {total.toLocaleString()} 条记录
            </p>
            <p className="text-xs text-slate-500">
              第 {page} / {totalPages} 页
            </p>
          </div>

          <div className="space-y-3 md:hidden">
            {loading ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-12 text-center text-sm text-slate-400">
                正在加载流水...
              </div>
            ) : transactions.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-12 text-center text-sm text-slate-400">
                没有找到符合条件的流水。
              </div>
            ) : (
              transactions.map((transaction) => {
                const description = parsePointDescription(
                  transaction.description
                );

                return (
                  <article
                    key={transaction.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="break-all font-semibold">
                          {transaction.email}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatTime(transaction.created_at)}
                        </p>
                      </div>
                      <p
                        className={`shrink-0 text-lg font-bold ${
                          transaction.change_amount >= 0
                            ? "text-cyan-300"
                            : "text-rose-300"
                        }`}
                      >
                        {transaction.change_amount >= 0 ? "+" : ""}
                        {transaction.change_amount.toLocaleString()}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-950/70 p-4 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">流水类型</p>
                        <p className="mt-1 font-semibold">
                          {transactionLabels[transaction.type] ||
                            transaction.type}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">变动后余额</p>
                        <p className="mt-1 font-semibold">
                          {transaction.balance_after.toLocaleString()} 点
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 text-sm leading-6">
                      <p className="text-xs text-slate-500">说明</p>
                      <p className="mt-1 break-words text-slate-300">
                        {description.note || "无说明"}
                      </p>
                      {description.adminEmail && (
                        <p className="mt-2 break-all text-xs text-slate-500">
                          操作管理员：{description.adminEmail}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-slate-800 md:block">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-slate-900 text-xs text-slate-400">
                <tr>
                  <th className="px-4 py-3">时间</th>
                  <th className="px-4 py-3">用户</th>
                  <th className="px-4 py-3">类型</th>
                  <th className="px-4 py-3">说明</th>
                  <th className="px-4 py-3">操作管理员</th>
                  <th className="px-4 py-3 text-right">变动</th>
                  <th className="px-4 py-3 text-right">余额</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      正在加载流水...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      没有找到符合条件的流水。
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => {
                    const description = parsePointDescription(
                      transaction.description
                    );

                    return (
                      <tr key={transaction.id} className="hover:bg-slate-900/60">
                        <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">
                          {formatTime(transaction.created_at)}
                        </td>
                        <td className="max-w-64 truncate px-4 py-4 font-semibold">
                          {transaction.email}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          {transactionLabels[transaction.type] ||
                            transaction.type}
                        </td>
                        <td className="max-w-72 truncate px-4 py-4 text-slate-400">
                          {description.note || "无说明"}
                        </td>
                        <td className="max-w-56 truncate px-4 py-4 text-xs text-slate-500">
                          {description.adminEmail || "—"}
                        </td>
                        <td
                          className={`px-4 py-4 text-right font-bold ${
                            transaction.change_amount >= 0
                              ? "text-cyan-300"
                              : "text-rose-300"
                          }`}
                        >
                          {transaction.change_amount >= 0 ? "+" : ""}
                          {transaction.change_amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {transaction.balance_after.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex justify-between">
            <button
              type="button"
              onClick={() => loadTransactions(page - 1)}
              disabled={loading || page <= 1}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 disabled:opacity-40"
            >
              上一页
            </button>
            <button
              type="button"
              onClick={() => loadTransactions(page + 1)}
              disabled={loading || page >= totalPages}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 disabled:opacity-40"
            >
              下一页
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

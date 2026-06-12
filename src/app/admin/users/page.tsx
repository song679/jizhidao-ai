"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type UserAccount = {
  id: string;
  email: string;
  points: number;
  updated_at: string;
};

type PointTransaction = {
  id: string;
  change_amount: number;
  balance_after: number;
  type: string;
  description: string | null;
  created_at: string;
};

const transactionLabels: Record<string, string> = {
  chat: "AI 聊天",
  recharge: "充值",
  refund: "退还",
  gift: "赠送",
  deduction: "管理员扣减",
};

export default function AdminUsersPage() {
  const [adminEmail, setAdminEmail] = useState("");
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState("");

  function formatTime(value: string) {
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  }

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

  async function loadUsers(nextPage = 1, nextSearch = search) {
    setLoading(true);
    setMessage("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) return;

      const params = new URLSearchParams({
        page: String(nextPage),
      });

      if (nextSearch.trim()) {
        params.set("search", nextSearch.trim());
      }

      const response = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "加载用户列表失败");
      }

      setAdminEmail(data.adminEmail || "");
      setUsers(Array.isArray(data.users) ? data.users : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setPage(typeof data.page === "number" ? data.page : nextPage);
      setPageSize(typeof data.pageSize === "number" ? data.pageSize : 50);
    } catch (error) {
      console.error("加载用户列表失败：", error);
      setMessage(error instanceof Error ? error.message : "加载用户列表失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadUserDetail(user: UserAccount) {
    setSelectedUser(user);
    setTransactions([]);
    setDetailLoading(true);
    setMessage("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) return;

      const response = await fetch(
        `/api/admin/users?email=${encodeURIComponent(user.email)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "加载用户详情失败");
      }

      setSelectedUser(data.user);
      setTransactions(
        Array.isArray(data.transactions) ? data.transactions : []
      );
    } catch (error) {
      console.error("加载用户详情失败：", error);
      setMessage(error instanceof Error ? error.message : "加载用户详情失败");
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadUsers(1, "");
    }, 0);

    return () => window.clearTimeout(timer);
    // Initial administrator check and user load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSelectedUser(null);
    setTransactions([]);
    loadUsers(1, search);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <Link href="/" className="text-2xl font-bold">
            极智岛 AI
          </Link>

          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/admin"
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
            >
              运营概览
            </Link>
            <Link
              href="/admin/recharge"
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
            >
              点数管理
            </Link>
            <Link
              href="/chat"
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300"
            >
              返回聊天
            </Link>
          </nav>
        </header>

        <section className="py-8">
          <p className="text-sm font-semibold text-cyan-300">管理员工具</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold">用户管理</h1>
              <p className="mt-2 text-sm text-slate-400">
                当前管理员：{adminEmail || "正在验证权限..."}
              </p>
            </div>
            <p className="text-sm text-slate-400">共 {total} 个点数账户</p>
          </div>
        </section>

        <form
          onSubmit={handleSearch}
          className="flex gap-3 border-y border-slate-800 py-5"
        >
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="输入邮箱搜索用户"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            搜索
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedUser(null);
                setTransactions([]);
                loadUsers(1, "");
              }}
              className="rounded-lg border border-slate-700 px-4 py-3 text-sm text-slate-300 hover:text-white"
            >
              清除
            </button>
          )}
        </form>

        {message && (
          <div className="mt-5 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {message}
          </div>
        )}

        <section className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <div className="min-w-0">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">用户列表</h2>
              <span className="text-xs text-slate-500">
                第 {page} / {totalPages} 页
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-slate-900 text-xs text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">邮箱</th>
                    <th className="px-4 py-3 text-right font-semibold">余额</th>
                    <th className="px-4 py-3 font-semibold">最近更新</th>
                    <th className="px-4 py-3 text-right font-semibold">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-slate-400"
                      >
                        正在加载用户...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-slate-400"
                      >
                        没有找到符合条件的用户。
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr
                        key={user.id}
                        className={
                          selectedUser?.id === user.id
                            ? "bg-cyan-400/10"
                            : "bg-slate-950 hover:bg-slate-900/70"
                        }
                      >
                        <td className="max-w-72 truncate px-4 py-4 font-semibold">
                          {user.email}
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-cyan-300">
                          {user.points.toLocaleString()} 点
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-400">
                          {formatTime(user.updated_at)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => loadUserDetail(user)}
                            className="font-semibold text-cyan-300 hover:text-cyan-200"
                          >
                            查看
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => loadUsers(page - 1, search)}
                disabled={loading || page <= 1}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                上一页
              </button>
              <button
                type="button"
                onClick={() => loadUsers(page + 1, search)}
                disabled={loading || page >= totalPages}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>

          <aside className="min-w-0 border-t border-slate-800 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <h2 className="text-xl font-bold">账户详情</h2>

            {!selectedUser ? (
              <p className="mt-5 text-sm leading-7 text-slate-400">
                从左侧列表选择用户，即可查看余额与最近 30 条点数流水。
              </p>
            ) : (
              <>
                <div className="mt-5 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
                  <p className="break-all font-semibold">{selectedUser.email}</p>
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-400">当前余额</p>
                      <p className="mt-1 text-3xl font-bold text-cyan-300">
                        {selectedUser.points.toLocaleString()} 点
                      </p>
                    </div>
                    <Link
                      href={`/admin/recharge?email=${encodeURIComponent(
                        selectedUser.email
                      )}`}
                      className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300"
                    >
                      为此用户充值
                    </Link>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">最近点数流水</h3>
                    <span className="text-xs text-slate-500">最多 30 条</span>
                  </div>

                  <div className="mt-3 divide-y divide-slate-800 border-y border-slate-800">
                    {detailLoading ? (
                      <p className="py-8 text-sm text-slate-400">
                        正在加载流水...
                      </p>
                    ) : transactions.length === 0 ? (
                      <p className="py-8 text-sm text-slate-400">
                        暂时没有点数流水。
                      </p>
                    ) : (
                      transactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="grid grid-cols-[1fr_auto] gap-4 py-4 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold">
                              {transactionLabels[transaction.type] ||
                                transaction.type}
                            </p>
                            <p className="mt-1 truncate text-slate-400">
                              {transaction.description || "无说明"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {formatTime(transaction.created_at)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={
                                transaction.change_amount >= 0
                                  ? "font-bold text-cyan-300"
                                  : "font-bold text-rose-300"
                              }
                            >
                              {transaction.change_amount >= 0 ? "+" : ""}
                              {transaction.change_amount.toLocaleString()}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              余额{" "}
                              {transaction.balance_after.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}

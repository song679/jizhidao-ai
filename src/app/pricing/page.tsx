"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PaymentRuntimeStatus } from "@/lib/payments/status";
import { supabase } from "@/lib/supabase";
import {
  formatPlanPrice,
  rechargePlans,
} from "@/lib/recharge-plans";


type RechargeOrder = {
  id: string;
  order_no: string;
  plan_id: string;
  plan_name: string;
  amount_cents: number;
  points: number;
  status: string;
  note?: string | null;
  created_at: string;
  expires_at: string;
  paid_at?: string | null;
};

export default function PricingPage() {
  const [userEmail, setUserEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedPlanName, setSelectedPlanName] = useState("");
  const [copyText, setCopyText] = useState("复制充值信息");
  const [contactCopyText, setContactCopyText] = useState("");
  const [currentOrder, setCurrentOrder] = useState<RechargeOrder | null>(null);
  const [orders, setOrders] = useState<RechargeOrder[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] =
    useState<PaymentRuntimeStatus | null>(null);

  useEffect(() => {
    async function getPaymentStatus() {
      try {
        const response = await fetch("/api/payments/status", {
          cache: "no-store",
        });
        const data = await response.json().catch(() => null);

        if (response.ok && data && typeof data.mode === "string") {
          setPaymentStatus(data as PaymentRuntimeStatus);
        }
      } catch (error) {
        console.error("Failed to load payment runtime status:", error);
      }
    }

    async function getUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setUserEmail(session?.user?.email || "");

      if (session) {
        const response = await fetch("/api/orders", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        const data = await response.json().catch(() => ({}));

        if (response.ok && Array.isArray(data.orders)) {
          setOrders(data.orders);
        }
      }
    }

    getPaymentStatus();
    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || "");
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handlePlanClick(planId: string) {
    const plan = rechargePlans.find((item) => item.id === planId);

    if (!plan) return;

    setSelectedPlanName(plan.name);
    setCurrentOrder(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setNotice(`你选择了「${plan.name}」。请先登录后创建充值订单。`);
      return;
    }

    setOrderLoading(true);
    setNotice("");

    try {
      if (paymentStatus?.onlinePaymentEnabled) {
        const response = await fetch("/api/payments/checkout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ planId }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || typeof data.checkoutUrl !== "string") {
          throw new Error(data?.error || "创建在线支付订单失败");
        }

        setNotice("正在跳转到安全支付页面，请稍候...");
        window.location.assign(data.checkoutUrl);
        return;
      }

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "创建充值订单失败");
      }

      setCurrentOrder(data.order);
      setOrders((prev) => [
        data.order,
        ...prev.filter((item) => item.id !== data.order.id),
      ]);
      setNotice(
        `${data.reused ? "已找到待处理订单" : "订单已创建"}：${data.order.order_no}。请把下方充值信息和付款截图发送给管理员。`
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "创建充值订单失败，请稍后重试"
      );
    } finally {
      setOrderLoading(false);
    }
  }

  const plans = rechargePlans.map((plan) => ({
    ...plan,
    price: formatPlanPrice(plan.priceCents),
    pointsLabel: `${plan.points.toLocaleString()} 点`,
    desc: plan.description,
    features: [
      `按 1 点模型约 ${plan.points.toLocaleString()} 次`,
      plan.id === "starter" ? "适合个人试用" : "适合长期使用",
      plan.id === "advanced" ? "支持多模型使用" : "点数明细可查",
    ],
    highlight: plan.highlighted,
  }));
  const selectedPlan =
    plans.find((plan) => plan.name === selectedPlanName) || plans[1];
  const adminWechat =
    process.env.NEXT_PUBLIC_ADMIN_WECHAT || "请联系项目管理员获取";
  const adminEmail =
    process.env.NEXT_PUBLIC_ADMIN_EMAIL || "请联系项目管理员获取";
  const rechargeMessage = [
    "极智岛 AI 充值申请",
    `登录邮箱：${userEmail || "请先登录后填写"}`,
    `选择套餐：${selectedPlan.name}`,
    `充值金额：¥${selectedPlan.price}`,
    `到账点数：${selectedPlan.pointsLabel}`,
    `订单编号：${currentOrder?.order_no || "选择套餐后自动生成"}`,
    `订单有效期：${
      currentOrder
        ? new Date(currentOrder.expires_at).toLocaleString("zh-CN", {
            hour12: false,
          })
        : "创建订单后显示"
    }`,
    "付款截图：已发送/稍后发送",
  ].join("\n");

  async function copyRechargeMessage() {
    try {
      await navigator.clipboard.writeText(rechargeMessage);
      setCopyText("已复制");
      window.setTimeout(() => setCopyText("复制充值信息"), 1600);
    } catch (error) {
      console.error("复制充值信息失败：", error);
      setCopyText("复制失败，请手动复制");
      window.setTimeout(() => setCopyText("复制充值信息"), 2000);
    }
  }

  async function copyContact(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setContactCopyText(`${label}已复制`);
      window.setTimeout(() => setContactCopyText(""), 1600);
    } catch (error) {
      console.error(`复制${label}失败：`, error);
      setContactCopyText(`复制${label}失败`);
      window.setTimeout(() => setContactCopyText(""), 2000);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            极智岛 AI
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="/chat" className="hover:text-white">
              AI聊天
            </a>
            <a href="/pricing" className="text-cyan-300">
              会员价格
            </a>
            <a href="/points" className="hover:text-white">
              点数明细
            </a>
          </nav>

          {userEmail ? (
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/points"
                className="hidden rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300 md:inline-block"
              >
                点数明细
              </a>
              <a
                href="/orders"
                className="hidden rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300 md:inline-block"
              >
                我的订单
              </a>
              <a
                href="/chat"
                className="rounded-full bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
              >
                进入 AI 聊天
              </a>
            </div>
          ) : (
            <a
              href="/login"
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200"
            >
              登录 / 注册
            </a>
          )}
        </header>

        {userEmail && (
          <nav className="mt-5 grid grid-cols-3 gap-2 text-center text-sm md:hidden">
            <Link
              href="/points"
              className="rounded-xl border border-slate-700 px-3 py-3 text-slate-300"
            >
              点数
            </Link>
            <Link
              href="/orders"
              className="rounded-xl border border-slate-700 px-3 py-3 text-slate-300"
            >
              订单
            </Link>
            <Link
              href="/account"
              className="rounded-xl border border-slate-700 px-3 py-3 text-slate-300"
            >
              账户
            </Link>
          </nav>
        )}

        <section className="py-12 text-center md:py-16">
          <p className="mx-auto mb-5 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300">
            点数充值 / 会员套餐
          </p>

          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            选择适合你的 AI 使用套餐
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            极智岛 AI 使用点数计费。正式支付开启后，可使用支付宝或微信支付完成充值。
          </p>

          {paymentStatus && (
            <div
              className={`mx-auto mt-6 max-w-2xl rounded-2xl border px-5 py-4 text-sm leading-6 ${
                paymentStatus.onlinePaymentEnabled
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                  : "border-amber-400/30 bg-amber-400/10 text-amber-100"
              }`}
            >
              {paymentStatus.onlinePaymentEnabled
                ? "当前已开启在线支付。请选择套餐后进入安全收银台，可使用已启用的支付宝或微信支付。"
                : "当前仍为手动充值模式：请选择套餐后生成订单，再联系管理员确认到账。"}
            </div>
          )}

          {notice && (
            <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-sm leading-6 text-cyan-100">
              {notice}
            </div>
          )}

          {currentOrder && (
            <div className="mx-auto mt-4 max-w-2xl rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-left text-sm leading-6 text-amber-100">
              <p className="font-bold">订单已进入待确认状态</p>
              <p className="mt-1">
                请在{" "}
                {new Date(currentOrder.expires_at).toLocaleString("zh-CN", {
                  hour12: false,
                })}{" "}
                前完成付款并把订单号、登录邮箱和付款截图发送给管理员。超过有效期后订单会自动关闭。
              </p>
              <Link
                href="/orders"
                className="mt-2 inline-block font-semibold text-amber-200 underline"
              >
                查看订单详情与状态
              </Link>
            </div>
          )}
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-3xl border p-6 sm:p-8 ${
                plan.highlight
                  ? "border-cyan-400 bg-slate-900 shadow-2xl shadow-cyan-950/40"
                  : "border-slate-800 bg-slate-900/60"
              }`}
            >
              {plan.highlight && (
                <div className="absolute right-6 top-6 rounded-full bg-cyan-400 px-3 py-1 text-xs font-bold text-slate-950">
                  推荐
                </div>
              )}

              <h2 className="text-2xl font-bold">{plan.name}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">{plan.desc}</p>

              <div className="mt-8">
                <span className="text-5xl font-bold">¥{plan.price}</span>
                <span className="ml-2 text-slate-400">/ 次</span>
              </div>

              <div className="mt-4 rounded-2xl bg-slate-950 p-4">
                <p className="text-sm text-slate-400">获得点数</p>
                <p className="mt-1 text-2xl font-bold text-cyan-300">
                  {plan.pointsLabel}
                </p>
              </div>

              <ul className="mt-8 space-y-3 text-sm text-slate-300">
                {plan.features.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>

              <button
                onClick={() => handlePlanClick(plan.id)}
                disabled={orderLoading}
                className={`mt-8 w-full rounded-2xl px-5 py-4 font-bold ${
                  plan.highlight
                    ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                    : "border border-slate-700 text-white hover:border-cyan-400/60 hover:text-cyan-300"
                }`}
              >
                {orderLoading && selectedPlanName === plan.name
                  ? "正在创建订单..."
                  : selectedPlanName === plan.name
                    ? "已选择"
                    : "选择套餐"}
              </button>
            </div>
          ))}
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
            <h2 className="text-2xl font-bold">
              {paymentStatus?.onlinePaymentEnabled ? "如何在线充值" : "如何充值"}
            </h2>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
              {paymentStatus?.onlinePaymentEnabled ? (
                <>
                  <p>1. 先登录网站，确认当前账号邮箱。</p>
                  <p>2. 点击上方套餐按钮，系统会创建订单并跳转到安全支付页面。</p>
                  <p>3. 在收银台或微信二维码页面完成付款。</p>
                  <p>4. 支付成功后系统会自动为你的账号增加对应点数。</p>
                  <p>5. 如遇到账延迟，可在订单页面查看状态或联系管理员。</p>
                </>
              ) : (
                <>
                  <p>1. 先登录网站，确认当前账号邮箱。</p>
                  <p>2. 点击上方套餐按钮，页面会自动生成充值信息。</p>
                  <p>3. 复制充值信息，连同付款截图一起发送给管理员。</p>
                  <p>4. 请在订单显示的有效期内付款，过期订单会自动关闭。</p>
                  <p>5. 管理员确认后，系统会为你的账号增加对应点数。</p>
                </>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-cyan-100">联系管理员</h2>
            <p className="mt-5 text-sm leading-7 text-cyan-50">
              当前为测试阶段，暂未开放自动支付。充值前请先确认账号邮箱，避免点数加到错误账号。
            </p>

            <div className="mt-6 space-y-3 text-sm">
              <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-cyan-200">管理员微信</p>
                    <p className="mt-1 break-all font-semibold text-white">
                      {adminWechat}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyContact(adminWechat, "微信")}
                    className="shrink-0 rounded-lg border border-cyan-300/30 px-3 py-2 text-xs font-semibold text-cyan-100"
                  >
                    复制
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-cyan-200">管理员邮箱</p>
                    <p className="mt-1 break-all font-semibold text-white">
                      {adminEmail}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyContact(adminEmail, "邮箱")}
                    className="shrink-0 rounded-lg border border-cyan-300/30 px-3 py-2 text-xs font-semibold text-cyan-100"
                  >
                    复制
                  </button>
                </div>
              </div>
              {contactCopyText && (
                <p className="text-center text-xs font-semibold text-cyan-100">
                  {contactCopyText}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-3xl border border-cyan-400/30 bg-slate-900/70 p-6 sm:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">发送给管理员的信息</h2>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                选择套餐后复制以下内容，并附上付款截图，管理员会按登录邮箱处理点数。
              </p>
            </div>

            <button
              onClick={copyRechargeMessage}
              className="w-full rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300 md:w-auto"
            >
              {copyText}
            </button>
          </div>

          <div className="mt-6 whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-950 p-5 text-sm leading-7 text-slate-200">
            {rechargeMessage}
          </div>

          {!userEmail && (
            <div className="mt-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100">
              你当前还没有登录。充值前请先登录，否则管理员无法准确为账号增加点数。
              <a href="/login" className="ml-2 font-semibold underline">
                去登录
              </a>
            </div>
          )}
        </section>

        {userEmail && (
          <section className="mt-12 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">我的充值订单</h2>
                <p className="mt-2 text-sm text-slate-400">
                  管理员确认到账后，订单状态和点数余额会同步更新。
                </p>
              </div>
              <Link
                href="/orders"
                className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
              >
                查看全部与订单详情 →
              </Link>
            </div>

            <div className="mt-6 divide-y divide-slate-800 border-y border-slate-800">
              {orders.length === 0 ? (
                <p className="py-8 text-sm text-slate-400">
                  暂时没有充值订单，选择上方套餐即可创建。
                </p>
              ) : (
                orders.map((order) => (
                  <div
                    key={order.id}
                    className="grid gap-3 py-4 text-sm md:grid-cols-[1fr_auto]"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {order.plan_name} · {order.points.toLocaleString()} 点
                      </p>
                      <p className="mt-1 break-all text-xs text-slate-400">
                        订单号：{order.order_no}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(order.created_at).toLocaleString("zh-CN", {
                          hour12: false,
                        })}
                      </p>
                    </div>
                    <div className="md:text-right">
                      <p className="font-bold text-cyan-300">
                        ¥{formatPlanPrice(order.amount_cents)}
                      </p>
                      <p
                        className={`mt-1 text-xs font-semibold ${
                          order.status === "paid"
                            ? "text-emerald-300"
                            : order.status === "pending"
                              ? "text-amber-300"
                              : "text-slate-400"
                        }`}
                      >
                        {order.status === "paid"
                          ? "已到账"
                          : order.status === "pending"
                            ? "待管理员确认"
                            : order.status === "cancelled"
                              ? order.note?.includes("超过有效期")
                                ? "已过期"
                                : "已取消"
                              : "已退款"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        <section className="mt-12 rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
          <h2 className="text-2xl font-bold">说明</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            <p>1. 当前为测试阶段，所有套餐主要用于页面展示和小范围试用。</p>
            <p>2. 新用户注册后默认赠送测试点数，可在点数明细页查看流水。</p>
            <p>3. 当前可按配置接入支付宝或微信支付，实现自动充值；Stripe 仅作为海外主体备用方案。</p>
            <p>4. 不同 AI 模型消耗点数不同，具体费用以聊天页模型选择器显示为准。</p>
          </div>
        </section>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 py-8 text-sm text-slate-400">
          <span>购买或使用点数前，请阅读相关规则。</span>
          <div className="flex gap-5">
            <Link href="/terms" className="text-cyan-300 hover:text-cyan-200">
              用户协议
            </Link>
            <Link href="/privacy" className="text-cyan-300 hover:text-cyan-200">
              隐私政策
            </Link>
            <Link href="/refund" className="text-cyan-300 hover:text-cyan-200">
              充值与退款
            </Link>
            <Link href="/support" className="text-cyan-300 hover:text-cyan-200">
              联系管理员
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

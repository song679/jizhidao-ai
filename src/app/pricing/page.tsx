"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PricingPage() {
  const [userEmail, setUserEmail] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function getUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setUserEmail(session?.user?.email || "");
    }

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

  function handlePlanClick(planName: string) {
    setNotice(
      `你选择了「${planName}」。当前为测试阶段，暂未接入在线支付。请联系管理员处理充值，并提供你的登录邮箱，管理员确认后会手动为你增加点数。`
    );
  }

  const plans = [
    {
      name: "体验包",
      price: "9.9",
      points: "1,000 点",
      desc: "适合轻度体验 AI 聊天、写文案、问问题。",
      features: ["约 1,000 次基础提问", "适合个人试用", "低成本体验"],
      highlight: false,
    },
    {
      name: "标准包",
      price: "29.9",
      points: "5,000 点",
      desc: "适合日常写作、办公、电商、自媒体使用。",
      features: ["约 5,000 次基础提问", "适合长期使用", "性价比更高"],
      highlight: true,
    },
    {
      name: "进阶包",
      price: "99",
      points: "20,000 点",
      desc: "适合高频使用、内容创作、电商运营和团队测试。",
      features: ["约 20,000 次基础提问", "适合高频用户", "后续可用于多模型"],
      highlight: false,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <a href="/" className="text-2xl font-bold tracking-tight">
            极智岛 AI
          </a>

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
            <div className="flex items-center gap-3">
              <a
                href="/points"
                className="hidden rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300 md:inline-block"
              >
                点数明细
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

        <section className="py-16 text-center">
          <p className="mx-auto mb-5 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300">
            点数充值 / 会员套餐
          </p>

          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            选择适合你的 AI 使用套餐
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            极智岛 AI 使用点数计费。测试阶段暂未接入在线支付，如需充值请联系管理员手动处理。
          </p>

          {notice && (
            <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-4 text-sm leading-6 text-cyan-100">
              {notice}
            </div>
          )}
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-3xl border p-8 ${
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
                <p className="mt-1 text-2xl font-bold text-cyan-300">{plan.points}</p>
              </div>

              <ul className="mt-8 space-y-3 text-sm text-slate-300">
                {plan.features.map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>

              <button
                onClick={() => handlePlanClick(plan.name)}
                className={`mt-8 w-full rounded-2xl px-5 py-4 font-bold ${
                  plan.highlight
                    ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                    : "border border-slate-700 text-white hover:border-cyan-400/60 hover:text-cyan-300"
                }`}
              >
                选择套餐
              </button>
            </div>
          ))}
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
            <h2 className="text-2xl font-bold">如何充值</h2>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
              <p>1. 先登录网站，确认你用于接收登录链接的邮箱。</p>
              <p>2. 点击上方套餐按钮，记下你选择的套餐名称。</p>
              <p>3. 联系管理员，并发送：登录邮箱、套餐名称、付款截图。</p>
              <p>4. 管理员确认后，会手动为你的账号增加对应点数。</p>
            </div>
          </div>

          <div className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-8">
            <h2 className="text-2xl font-bold text-cyan-100">联系管理员</h2>
            <p className="mt-5 text-sm leading-7 text-cyan-50/90">
              当前为测试阶段，暂未开放自动支付。如需充值，请通过你与管理员约定的微信、邮箱或其他联系方式处理。
            </p>
            <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-slate-950/50 p-4 text-sm leading-7 text-cyan-50">
              <p>请提供：登录邮箱</p>
              <p>请提供：选择的套餐</p>
              <p>请提供：付款截图或转账备注</p>
            </div>
          </div>
        </section>

        <section className="mt-12 rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
          <h2 className="text-2xl font-bold">说明</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            <p>1. 当前为测试阶段，所有套餐主要用于页面展示和小范围试用。</p>
            <p>2. 新用户注册后默认赠送测试点数，可在点数明细页查看流水。</p>
            <p>3. 后续可接入微信、支付宝或 Stripe 支付，实现自动充值。</p>
            <p>4. 点数消耗规则后续可以按不同 AI 模型单独设置。</p>
          </div>
        </section>
      </div>
    </main>
  );
}

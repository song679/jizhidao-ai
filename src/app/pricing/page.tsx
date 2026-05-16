export default function PricingPage() {
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
          <a href="/" className="text-2xl font-bold">
            极智岛 AI
          </a>

          <nav className="flex items-center gap-6 text-sm text-slate-300">
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
        </header>

        <section className="py-16 text-center">
          <p className="mx-auto mb-5 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300">
            点数充值 / 会员套餐
          </p>

          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            选择适合你的 AI 使用套餐
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            极智岛 AI 使用点数计费。测试阶段套餐仅作展示，后续将接入正式支付系统。
          </p>
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
                disabled
                className={`mt-8 w-full rounded-2xl px-5 py-4 font-bold ${
                  plan.highlight
                    ? "bg-cyan-400 text-slate-950"
                    : "bg-slate-800 text-white"
                } opacity-70`}
              >
                暂未开放支付
              </button>
            </div>
          ))}
        </section>

        <section className="mt-12 rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
          <h2 className="text-2xl font-bold">说明</h2>
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            <p>1. 当前为测试阶段，所有套餐仅用于页面展示。</p>
            <p>2. 新用户注册后默认赠送测试点数。</p>
            <p>3. 后续可接入微信、支付宝或 Stripe 支付。</p>
            <p>4. 点数规则后续可以按不同 AI 模型单独设置消耗比例。</p>
          </div>
        </section>
      </div>
    </main>
  );
}
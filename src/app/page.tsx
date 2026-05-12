export default function Home() {
  const tools = [
    {
      name: "ChatGPT",
      desc: "适合日常聊天、写作、翻译、代码、学习辅导。",
      tag: "通用AI",
    },
    {
      name: "Claude",
      desc: "适合长文写作、文档总结、深度分析。",
      tag: "写作分析",
    },
    {
      name: "Gemini",
      desc: "适合搜索、办公、多模态理解。",
      tag: "Google AI",
    },
    {
      name: "DeepSeek",
      desc: "中文能力强，成本低，适合日常使用。",
      tag: "国产模型",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <div className="text-2xl font-bold tracking-tight">极智岛 AI</div>
          <nav className="hidden gap-6 text-sm text-slate-300 md:flex">
            <a href="#" className="hover:text-white">AI聊天</a>
            <a href="#" className="hover:text-white">写作助手</a>
            <a href="#" className="hover:text-white">AI工具</a>
            <a href="#" className="hover:text-white">会员价格</a>
          </nav>
          <a
           href="/login"
           className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950"
          >
            登录 / 注册
          </a>
        </header>

        <div className="grid flex-1 items-center gap-12 py-20 md:grid-cols-2">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
              小而美的 AI 模型聚合平台
            </div>

            <h1 className="text-5xl font-bold leading-tight md:text-6xl">
              一个入口，
              <br />
              使用全球优质 AI。
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              极智岛 AI 聚合好用的 AI 模型和工具，帮助普通用户低门槛使用 AI 聊天、写作、办公、短视频和电商制图能力。
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
               href="/chat"
               className="rounded-full bg-cyan-400 px-7 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
                  >
                 立即体验
              </a>
              <a
                href="/chat"
               className="rounded-full border border-slate-700 px-7 py-3 font-semibold text-white hover:bg-slate-900"
               >
                查看AI工具
              </a>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4 text-sm text-slate-400">
              <div>
                <div className="text-2xl font-bold text-white">多模型</div>
                <div>灵活切换</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">低门槛</div>
                <div>国内用户友好</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">精选</div>
                <div>拒绝垃圾工具</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-400"></div>
              <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
              <div className="h-3 w-3 rounded-full bg-green-400"></div>
            </div>

            <div className="rounded-2xl bg-slate-950 p-5">
              <div className="mb-4 text-sm text-slate-400">AI 对话助手</div>

              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-800 p-4 text-sm text-slate-200">
                  帮我写一段适合小红书发布的 AI 工具推荐文案。
                </div>

                <div className="rounded-2xl bg-cyan-400/10 p-4 text-sm leading-7 text-cyan-100">
                  当然可以。你可以这样写：今天分享几个真正能提高效率的 AI 工具，不堆概念，只推荐普通人真的用得上的……
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <input
                  className="flex-1 rounded-full border border-slate-800 bg-slate-900 px-4 py-3 text-sm outline-none"
                  placeholder="输入你的问题..."
                />
                <button className="rounded-full bg-cyan-400 px-5 text-sm font-semibold text-slate-950">
                  发送
                </button>
              </div>
            </div>
          </div>
        </div>

        <section className="pb-12">
          <h2 className="mb-6 text-2xl font-bold">精选 AI 模型</h2>

          <div className="grid gap-4 md:grid-cols-4">
            {tools.map((tool) => (
              <div
                key={tool.name}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-cyan-400/50"
              >
                <div className="mb-3 inline-flex rounded-full bg-slate-800 px-3 py-1 text-xs text-cyan-200">
                  {tool.tag}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{tool.name}</h3>
                <p className="text-sm leading-6 text-slate-400">{tool.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
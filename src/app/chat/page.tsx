export default function ChatPage() {
  const messages = [
    {
      role: "assistant",
      content:
        "你好，我是极智岛 AI。你可以问我写作、办公、电商、短视频、学习、代码等问题。",
    },
    {
      role: "user",
      content: "帮我写一段适合小红书发布的 AI 工具推荐文案。",
    },
    {
      role: "assistant",
      content:
        "当然可以。你可以这样写：今天分享几个真正能提高效率的 AI 工具，不堆概念，只推荐普通人真的用得上的工具……",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6">
        <header className="mb-6 flex items-center justify-between border-b border-slate-800 pb-5">
          <a href="/" className="text-2xl font-bold">
            极智岛 AI
          </a>

          <div className="flex items-center gap-3">
            <button className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900">
              当前模型：DeepSeek
            </button>
            <button className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950">
              登录 / 注册
            </button>
          </div>
        </header>

        <section className="grid flex-1 gap-6 md:grid-cols-[260px_1fr]">
          <aside className="hidden rounded-3xl border border-slate-800 bg-slate-900/60 p-5 md:block">
            <h2 className="mb-4 text-lg font-semibold">AI 功能</h2>

            <div className="space-y-3 text-sm">
              <button className="w-full rounded-2xl bg-cyan-400 px-4 py-3 text-left font-semibold text-slate-950">
                AI 聊天
              </button>
              <button className="w-full rounded-2xl px-4 py-3 text-left text-slate-300 hover:bg-slate-800">
                写文章
              </button>
              <button className="w-full rounded-2xl px-4 py-3 text-left text-slate-300 hover:bg-slate-800">
                小红书文案
              </button>
              <button className="w-full rounded-2xl px-4 py-3 text-left text-slate-300 hover:bg-slate-800">
                电商标题
              </button>
              <button className="w-full rounded-2xl px-4 py-3 text-left text-slate-300 hover:bg-slate-800">
                短视频脚本
              </button>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-sm text-slate-400">剩余点数</div>
              <div className="mt-2 text-3xl font-bold text-cyan-300">1000</div>
              <div className="mt-1 text-xs text-slate-500">测试账户赠送</div>
            </div>
          </aside>

          <section className="flex min-h-[75vh] flex-col rounded-3xl border border-slate-800 bg-slate-900/60">
            <div className="border-b border-slate-800 p-5">
              <h1 className="text-xl font-bold">AI 聊天</h1>
              <p className="mt-1 text-sm text-slate-400">
                支持日常聊天、写作、办公、电商、短视频内容创作。
              </p>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-3xl px-5 py-4 text-sm leading-7 ${
                      message.role === "user"
                        ? "bg-cyan-400 text-slate-950"
                        : "bg-slate-800 text-slate-100"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 p-5">
              <div className="flex gap-3">
                <textarea
                  className="min-h-14 flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                  placeholder="输入你的问题，比如：帮我写一篇小红书文案..."
                />
                <button className="rounded-2xl bg-cyan-400 px-6 font-semibold text-slate-950 hover:bg-cyan-300">
                  发送
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                当前为界面演示版本，下一步将接入真实 AI 模型。
              </p>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
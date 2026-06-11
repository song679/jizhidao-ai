"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [userEmail, setUserEmail] = useState("");

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

  const features = [
    {
      name: "AI 聊天",
      desc: "日常提问、学习解释、代码问题、生活办公问题，都可以直接问。",
      tag: "通用助手",
    },
    {
      name: "写文章",
      desc: "帮你写文章、整理观点、优化表达，适合自媒体和办公场景。",
      tag: "内容创作",
    },
    {
      name: "小红书文案",
      desc: "生成标题、正文、种草文案和话题标签，适合社媒内容发布。",
      tag: "社媒文案",
    },
    {
      name: "电商标题",
      desc: "根据产品卖点生成更适合平台搜索和转化的商品标题。",
      tag: "电商运营",
    },
    {
      name: "短视频脚本",
      desc: "生成开头钩子、分镜、口播文案和结尾引导，降低创作门槛。",
      tag: "短视频",
    },
    {
      name: "点数计费",
      desc: "测试阶段采用点数制，使用记录清晰可查，后续可接入会员套餐。",
      tag: "账户系统",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="mb-12 flex items-center justify-between border-b border-slate-800 pb-6">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            极智岛 AI
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="/chat" className="hover:text-white">
              AI 聊天
            </a>
            <a href="/pricing" className="hover:text-white">
              会员价格
            </a>
            <a href="/points" className="hover:text-white">
              点数明细
            </a>
          </nav>

          {userEmail ? (
            <a
              href="/chat"
              className="rounded-full bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300"
            >
              进入 AI 聊天
            </a>
          ) : (
            <a
              href="/login"
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200"
            >
              登录 / 注册
            </a>
          )}
        </header>

        <section className="grid flex-1 items-center gap-12 py-10 md:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300">
              中文 AI 聚合平台
            </div>

            <h1 className="text-5xl font-bold leading-tight md:text-6xl">
              一个账号，
              <br />
              连接多种 AI 能力。
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              极智岛 AI 支持聊天、写作、办公、电商文案、短视频脚本等场景。
              测试阶段已接入 DeepSeek，后续将继续接入更多主流 AI 模型，
              让普通用户用更简单的方式解决实际问题。
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="/chat"
                className="rounded-full bg-cyan-400 px-7 py-3 font-semibold text-slate-950 hover:bg-cyan-300"
              >
                开始使用 AI
              </a>

              <a
                href="/pricing"
                className="rounded-full border border-slate-700 px-7 py-3 font-semibold text-white hover:border-cyan-400/60 hover:text-cyan-300"
              >
                查看会员价格
              </a>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4 text-sm text-slate-400">
              <div>
                <div className="text-2xl font-bold text-white">多场景</div>
                <div>聊天 / 写作 / 办公</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">点数制</div>
                <div>使用记录清晰</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">低门槛</div>
                <div>普通用户友好</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-400" />
              <div className="h-3 w-3 rounded-full bg-yellow-400" />
              <div className="h-3 w-3 rounded-full bg-green-400" />
            </div>

            <div className="rounded-2xl bg-slate-950 p-5">
              <div className="mb-4 text-sm text-slate-400">AI 对话助手</div>

              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-800 p-4 text-sm text-slate-200">
                  帮我写一段适合小红书发布的 AI 工具推荐文案。
                </div>

                <div className="rounded-2xl bg-cyan-400/10 p-4 text-sm leading-7 text-cyan-100">
                  当然可以。你可以这样写：今天分享几个真正能提高效率的
                  AI 工具，不堆概念，只推荐普通人真的用得上的功能……
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <input
                  className="flex-1 rounded-full border border-slate-800 bg-slate-900 px-4 py-3 text-sm outline-none placeholder:text-slate-600"
                  placeholder="输入你的问题..."
                />
                <button className="rounded-full bg-cyan-400 px-5 text-sm font-semibold text-slate-950">
                  发送
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-cyan-300">
                核心功能
              </div>
              <h2 className="mt-2 text-2xl font-bold">适合普通用户的 AI 工具箱</h2>
            </div>
            <a href="/chat" className="text-sm font-semibold text-cyan-300">
              立即体验 →
            </a>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {features.map((item) => (
              <div
                key={item.name}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-cyan-400/40"
              >
                <div className="mb-3 inline-flex rounded-full bg-slate-800 px-3 py-1 text-xs text-cyan-300">
                  {item.tag}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{item.name}</h3>
                <p className="text-sm leading-6 text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 py-8 text-sm text-slate-500">
          <span>极智岛 AI</span>
          <Link href="/terms" className="hover:text-white">
            用户协议
          </Link>
        </footer>
      </section>
    </main>
  );
}

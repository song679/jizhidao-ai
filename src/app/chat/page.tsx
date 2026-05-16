"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/lib/supabase";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
       const defaultMessages: Message[] = [
       {
         role: "assistant",
         content:
           "你好，我是极智岛 AI。你可以问我写作、办公、电商、短视频、学习、代码等问题。",
       },
     ];

  const [messages, setMessages] = useState<Message[]>(defaultMessages);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [points, setPoints] = useState<number>(1000);
  const [activeTool, setActiveTool] = useState("AI 聊天");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);
  
  useEffect(() => {
  async function getUser() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    setUserEmail("");
    return;
  }

  const response = await fetch("/api/points", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(data);
    setUserEmail(session.user.email || "");
    return;
  }

  setUserEmail(data.email || session.user.email || "");
  setPoints(typeof data.points === "number" ? data.points : 0);

        const historyResponse = await fetch("/api/chat/history", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const historyData = await historyResponse.json();

      if (historyResponse.ok && Array.isArray(historyData.messages)) {
        const loadedMessages = historyData.messages.filter(
          (item: Message) =>
            (item.role === "user" || item.role === "assistant") &&
            typeof item.content === "string"
        );

        if (loadedMessages.length > 0) {
          setMessages(loadedMessages);
        } else {
          setMessages(defaultMessages);
       }
     }
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

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const welcome = params.get("welcome");

  if (welcome === "1") {
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          "欢迎回来！新用户已赠送 1000 点，可直接开始使用 AI 聊天、写作、办公、电商文案等功能。",
      },
    ]);

    window.history.replaceState({}, "", "/chat");
  }
}, []);

async function logout() {
  await supabase.auth.signOut();
  setUserEmail("");
  window.location.href = "/login";
}

      function usePromptTemplate(toolName: string, template: string) {
        setActiveTool(toolName);
        setInput(template);
      }

  async function sendMessage() {
  const userText = input.trim();

  if (!userText || loading) return;

  if (!userEmail) {
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "请先登录后再使用聊天功能。",
      },
    ]);
    return;
  }

   if (points <= 0) {
    setMessages([
      ...messages,
      {
        role: "assistant",
        content: "你的点数已用完，请前往 [会员价格页](/pricing) 充值后继续使用 AI 聊天功能。",
      },
    ]);
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "登录状态已失效，请重新登录后再使用聊天功能。",
      },
    ]);
    return;
  }

  const newMessages: Message[] = [
      ...messages,
      {
        role: "user",
        content: userText,
      },
    ];

    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    messages: newMessages,
  }),
});

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || data?.error || "请求失败");
      }

      if (typeof data.points === "number") {
        setPoints(data.points);
      }

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: data.reply || "抱歉，我暂时没有生成回复。",
        },
      ]);
    } catch (error) {
      console.error(error);

      const errorMessage =
        error instanceof Error ? error.message : "未知错误";

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `抱歉，AI 暂时无法回复。\n\n错误信息：${errorMessage}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

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

            <a
              href="/pricing"
              className="rounded-full border border-cyan-400/30 px-5 py-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10"
            >
              充值 / 会员
            </a>

            {userEmail ? (
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-slate-300 md:inline">
                  {userEmail}
                </span>
                <button
                  onClick={logout}
                  className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950"
                >
                  退出登录
                </button>
              </div>
            ) : (
              <a
                href="/login"
                className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950"
              >
                登录 / 注册
              </a>
            )}
          </div>
        </header>

        <section className="grid flex-1 gap-6 md:grid-cols-[260px_1fr]">
          <aside className="hidden rounded-3xl border border-slate-800 bg-slate-900/60 p-5 md:block">
            <h2 className="mb-4 text-lg font-semibold">AI 功能</h2>

            <div className="space-y-3 text-sm">
              <button
                onClick={() => {
                  setActiveTool("AI 聊天");
                  setInput("");
                }}
                className={`w-full rounded-2xl px-4 py-3 text-left font-semibold ${
                  activeTool === "AI 聊天"
                    ? "bg-cyan-400 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                AI 聊天
              </button>

              <button
                onClick={() =>
                  usePromptTemplate(
                    "写文章",
                    "帮我写一篇文章，主题是：____。要求：结构清晰、语言通俗、适合普通用户阅读，字数控制在 800 字左右。"
                  )
                }
                className={`w-full rounded-2xl px-4 py-3 text-left font-semibold ${
                  activeTool === "写文章"
                    ? "bg-cyan-400 text-slate-950"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                写文章
              </button>

            <button
              onClick={() =>
                usePromptTemplate(
                  "小红书文案",
                  "帮我写一篇小红书文案，产品/主题是：____。要求：标题吸引人，正文像真人分享，带 3-5 个 emoji，最后加几个相关话题标签。"
                )
              }
              className={`w-full rounded-2xl px-4 py-3 text-left font-semibold ${
                activeTool === "小红书文案"
                  ? "bg-cyan-400 text-slate-950"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              小红书文案
            </button>

            <button
              onClick={() =>
                usePromptTemplate(
                  "电商标题",
                  "帮我生成 10 个电商商品标题，产品是：____。要求：突出卖点，适合电商平台搜索，标题简洁有吸引力。"
                )
              }
              className={`w-full rounded-2xl px-4 py-3 text-left font-semibold ${
                activeTool === "电商标题"
                  ? "bg-cyan-400 text-slate-950"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              电商标题
            </button>

            <button
              onClick={() =>
                usePromptTemplate(
                  "短视频脚本",
                  "帮我写一个短视频脚本，主题是：____。要求：包含开头钩子、分镜内容、口播文案和结尾引导，时长控制在 60 秒左右。"
                )
              }
              className={`w-full rounded-2xl px-4 py-3 text-left font-semibold ${
                activeTool === "短视频脚本"
                  ? "bg-cyan-400 text-slate-950"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              短视频脚本
            </button>

            </div>

            <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-sm text-slate-400">剩余点数</div>
              <div className="mt-2 text-3xl font-bold text-cyan-300">{points}</div>
              <div className="mt-1 text-xs text-slate-500">测试账户赠送</div>
              <a
                href="/pricing"
                className="mt-3 inline-block text-xs font-semibold text-cyan-300 hover:text-cyan-200"
              >
                充值点数 →
              </a>
              <a
                 href="/points"
               className="mt-2 inline-block text-xs font-semibold text-slate-400 hover:text-white"
             >
               点数明细 →
              </a>
            </div>
          </aside>

          <section className="flex min-h-[75vh] flex-col rounded-3xl border border-slate-800 bg-slate-900/60">
            <div className="border-b border-slate-800 p-5">
              <h1 className="text-xl font-bold">{activeTool}</h1>
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
                    className={`max-w-[85%] rounded-3xl px-5 py-4 text-sm leading-7 ${
                      message.role === "user"
                        ? "bg-cyan-400 text-slate-950"
                        : "bg-slate-800 text-slate-100"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="prose prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-strong:text-white prose-code:rounded prose-code:bg-slate-950 prose-code:px-1 prose-code:py-0.5 prose-code:text-cyan-200">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">
                        {message.content}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-3xl bg-slate-800 px-5 py-4 text-sm text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300"></span>
                      <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 delay-150"></span>
                      <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 delay-300"></span>
                      <span className="ml-2">AI 正在思考中...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            <div className="border-t border-slate-800 p-5">
              {!userEmail && (
                <div className="mb-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100">
                  请先登录后使用 AI 聊天功能。
                  <a href="/login" className="ml-2 font-semibold underline">
                    去登录
                  </a>
                </div>
              )}

              <div className="flex gap-3">
               <textarea
                 value={input}
                 onChange={(event) => setInput(event.target.value)}
                 onKeyDown={(event) => {
                   if (event.key === "Enter" && !event.shiftKey) {
                     event.preventDefault();
                     sendMessage();
                   }
                 }}
                 disabled={!userEmail || loading || points <= 0}
                 className="min-h-14 flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                 placeholder={
                   !userEmail
                     ? "请先登录后使用聊天功能"
                     : points <= 0
                       ? "点数已用完，请点击上方或左侧的充值入口继续使用。"
                       : "输入你的问题，比如：帮我写一篇小红书文案..."
                 }
               />
                <button
                  onClick={sendMessage}
                  disabled={!userEmail || loading || points <= 0}
                  className="rounded-2xl bg-cyan-400 px-6 font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "思考中..." : !userEmail ? "请先登录" : points <= 0 ? "点数不足" : "发送"}
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                {!userEmail
                  ? "请先登录后使用 AI 聊天功能。"
                  : points <= 0
                    ? "点数已用完，请充值后继续使用 AI 聊天功能。"
                    : "当前已接入 DeepSeek 模型，测试阶段请勿输入敏感信息。按 Enter 发送，Shift + Enter 换行。"}
              </p>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
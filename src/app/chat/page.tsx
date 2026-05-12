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
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "你好，我是极智岛 AI。你可以问我写作、办公、电商、短视频、学习、代码等问题。",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);
  
  useEffect(() => {
  async function getUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.email) {
      setUserEmail(user.email);
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

async function logout() {
  await supabase.auth.signOut();
  setUserEmail("");
  window.location.href = "/login";
}

  async function sendMessage() {
    const userText = input.trim();

    if (!userText || loading) return;

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
        },
        body: JSON.stringify({
          messages: newMessages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || data?.error || "请求失败");
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

      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content:
            "抱歉，AI 暂时无法回复。请检查 DeepSeek API Key、账户余额或稍后再试。",
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
                  className="min-h-14 flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                  placeholder="输入你的问题，比如：帮我写一篇小红书文案..."
                />
                <button
                  onClick={sendMessage}
                  disabled={loading}
                  className="rounded-2xl bg-cyan-400 px-6 font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "思考中" : "发送"}
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                当前已接入 DeepSeek 模型，测试阶段请勿输入敏感信息。按 Enter 发送，Shift + Enter 换行。
              </p>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/lib/supabase";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ChatSession = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type ModelOption = {
  id: string;
  provider: "deepseek" | "openai";
  model: string;
  displayName: string;
  label: string;
  pointCost: number;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [points, setPoints] = useState<number>(1000);
  const [activeTool, setActiveTool] = useState("AI 聊天");
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const selectedModel =
    modelOptions.find((option) => option.id === selectedModelId) ||
    modelOptions[0];
  const modelName = selectedModel?.displayName || "AI";
  const selectedPointCost = selectedModel?.pointCost || 1;
  const hasEnoughPoints = points >= selectedPointCost;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    async function getChatConfig() {
      try {
        const response = await fetch("/api/chat/config");
        const data = await response.json();

        if (response.ok && Array.isArray(data.models)) {
          setModelOptions(data.models);
          setSelectedModelId(data.modelId || data.models[0]?.id || "");
        }
      } catch (error) {
        console.error("加载模型配置失败：", error);
      }
    }

    getChatConfig();
  }, []);
  
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

        try {
          const adminResponse = await fetch("/api/admin/recharge", {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          setIsAdmin(adminResponse.ok);
        } catch (error) {
          console.error("检查管理员权限失败：", error);
          setIsAdmin(false);
        }

        const sessionList = await fetchSessions(session.access_token);

        if (sessionList.length > 0) {
          const firstSession = sessionList[0];
          setCurrentSessionId(firstSession.id);
          await loadSessionMessages(firstSession.id);
        } else {
          await createChatSession(session.access_token);
        }
}

  getUser();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    setUserEmail(session?.user?.email || "");
    if (!session) {
      setIsAdmin(false);
    }
  });

  return () => {
    subscription.unsubscribe();
  };
  // This bootstrap intentionally runs once for the initial authenticated session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const welcome = params.get("welcome");

  if (welcome === "1") {
    const timer = window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "欢迎回来！新用户已赠送 1000 点，可直接开始使用 AI 聊天、写作、办公、电商文案等功能。",
        },
      ]);
    }, 0);

    window.history.replaceState({}, "", "/chat");

    return () => window.clearTimeout(timer);
  }
}, []);

async function logout() {
  await supabase.auth.signOut();
  setUserEmail("");
  window.location.href = "/login";
}

      function applyPromptTemplate(toolName: string, template: string) {
        setActiveTool(toolName);
        setInput(template);
      }

    async function fetchSessions(accessToken: string) {
      const response = await fetch("/api/chat/sessions", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (response.ok && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
        return data.sessions as ChatSession[];
      }

      console.error(data);
      return [];
    }

    async function createChatSession(accessToken: string) {
      const response = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "新聊天",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(data);
        alert(data?.error || "创建新聊天失败");
        return null;
      }

      const newSession = data.session as ChatSession;

      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      setMessages(defaultMessages);
      setInput("");
      setActiveTool("AI 聊天");

      return newSession;
    }

    async function loadSessionMessages(sessionId: string) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch(`/api/chat/history?session_id=${sessionId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(data);
        alert(data?.error || "加载聊天记录失败");
        return;
      }

      const loadedMessages = Array.isArray(data.messages)
        ? data.messages.filter(
            (item: Message) =>
              (item.role === "user" || item.role === "assistant") &&
              typeof item.content === "string"
          )
        : [];

      setCurrentSessionId(sessionId);
      setMessages(loadedMessages.length > 0 ? loadedMessages : defaultMessages);
      setInput("");
      setActiveTool("AI 聊天");
    }

    async function startNewChat() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "/login";
    return;
  }

  await createChatSession(session.access_token);
}

    async function clearChatHistory() {
  const confirmed = window.confirm("确定要清空聊天记录吗？清空后无法恢复。");

  if (!confirmed) {
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "/login";
    return;
  }

  const response = await fetch("/api/chat/history", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(data);
    alert(data?.error || "清空聊天记录失败");
    return;
  }

  setMessages(defaultMessages);
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

   if (!hasEnoughPoints) {
    setMessages([
      ...messages,
      {
        role: "assistant",
        content: `当前模型每次需要 ${selectedPointCost} 点，你的余额不足。请切换其他模型或前往 [会员价格页](/pricing) 充值。`,
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
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          sessionId: currentSessionId,
          modelId: selectedModel?.id,
          provider: selectedModel?.provider,
          model: selectedModel?.model,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || data?.error || "请求失败");
      }

      if (typeof data.points === "number") {
        setPoints(data.points);
      }

      if (typeof data.modelId === "string") {
        setSelectedModelId(data.modelId);
      }

      if (data.sessionId && !currentSessionId) {
        setCurrentSessionId(data.sessionId);
      }

      const {
        data: { session: latestSession },
      } = await supabase.auth.getSession();

      if (latestSession) {
        await fetchSessions(latestSession.access_token);
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
          content: "抱歉，当前出现内部技术问题，请联系管理员。",
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
          <Link href="/" className="text-2xl font-bold tracking-tight">
            极智岛 AI
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="/chat" className="text-cyan-300">
              AI聊天
            </a>
            <a href="/pricing" className="hover:text-white">
              会员价格
            </a>
            <a href="/points" className="hover:text-white">
              点数明细
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <label className="hidden items-center rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 md:flex">
              <span className="mr-2 shrink-0">当前模型：</span>
              <select
                value={selectedModelId}
                onChange={(event) => setSelectedModelId(event.target.value)}
                disabled={loading || modelOptions.length === 0}
                className="max-w-44 bg-transparent font-semibold text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {modelOptions.length === 0 ? (
                  <option className="bg-slate-950 text-white" value="">
                    加载中
                  </option>
                ) : (
                  modelOptions.map((option) => (
                    <option
                      key={option.id}
                      className="bg-slate-950 text-white"
                      value={option.id}
                    >
                      {option.label}
                    </option>
                  ))
                )}
              </select>
            </label>

            <a
              href="/pricing"
              className="rounded-full border border-cyan-400/40 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10"
            >
              充值 / 会员
            </a>

            {isAdmin && (
              <a
                href="/admin/recharge"
                className="hidden rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300 xl:inline-block"
              >
                管理充值
              </a>
            )}

            {userEmail && (
              <span className="hidden text-sm text-slate-300 lg:inline">
                {userEmail}
              </span>
            )}

            {userEmail ? (
              <button
                onClick={logout}
                className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200"
              >
                退出登录
              </button>
            ) : (
              <a
                href="/login"
                className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200"
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
                  applyPromptTemplate(
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
                applyPromptTemplate(
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
                applyPromptTemplate(
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
                applyPromptTemplate(
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

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-300">历史会话</div>
              <button
                onClick={startNewChat}
                className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
              >
                新建
              </button>
            </div>

            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {sessions.length === 0 ? (
                <div className="text-xs text-slate-500">暂无历史会话</div>
              ) : (
                sessions.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadSessionMessages(item.id)}
                    className={`w-full truncate rounded-xl px-3 py-2 text-left text-xs ${
                      currentSessionId === item.id
                        ? "bg-cyan-400 text-slate-950"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                    title={item.title}
                  >
                    {item.title}
                  </button>
                ))
              )}
            </div>
          </div>

          </aside>

          <section className="flex h-[75vh] min-h-0 flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/60">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 p-5">
              <div>
                <h1 className="text-xl font-bold">{activeTool}</h1>
                <p className="mt-1 text-sm text-slate-400">
                  支持日常聊天、写作、办公、电商、短视频内容创作。
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center rounded-full border border-slate-700 px-3 py-2 text-xs text-slate-300 md:hidden">
                  <span className="mr-2 shrink-0">模型</span>
                  <select
                    value={selectedModelId}
                    onChange={(event) =>
                      setSelectedModelId(event.target.value)
                    }
                    disabled={loading || modelOptions.length === 0}
                    className="max-w-40 bg-transparent font-semibold text-white outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {modelOptions.length === 0 ? (
                      <option className="bg-slate-950 text-white" value="">
                        加载中
                      </option>
                    ) : (
                      modelOptions.map((option) => (
                        <option
                          key={option.id}
                          className="bg-slate-950 text-white"
                          value={option.id}
                        >
                          {option.label}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <button
                  onClick={startNewChat}
                  className="rounded-full border border-cyan-400/40 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/10"
                >
                  新聊天
                </button>

                <button
                  onClick={clearChatHistory}
                  className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-400 hover:border-red-400/60 hover:text-red-300"
                >
                  清空记录
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
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

            <div className="border-t border-slate-800 bg-slate-900/80 p-5">
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
                 disabled={!userEmail || loading || !hasEnoughPoints}
                 className="min-h-14 flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                 placeholder={
                   !userEmail
                     ? "请先登录后使用聊天功能"
                     : !hasEnoughPoints
                       ? `当前模型需要 ${selectedPointCost} 点，请充值或切换模型。`
                       : "输入你的问题，比如：帮我写一篇小红书文案..."
                 }
               />
                <button
                  onClick={sendMessage}
                  disabled={!userEmail || loading || !hasEnoughPoints}
                  className="rounded-2xl bg-cyan-400 px-6 font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "思考中..." : !userEmail ? "请先登录" : !hasEnoughPoints ? "点数不足" : "发送"}
                </button>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                {!userEmail
                  ? "请先登录后使用 AI 聊天功能。"
                  : !hasEnoughPoints
                    ? `当前 ${modelName} 模型每次需要 ${selectedPointCost} 点，余额不足，请充值或切换模型。`
                    : `当前已接入 ${modelName} 模型，每次消耗 ${selectedPointCost} 点。测试阶段请勿输入敏感信息。按 Enter 发送，Shift + Enter 换行。`}
              </p>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

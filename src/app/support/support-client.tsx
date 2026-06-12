"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const issueTypes = [
  "登录或注册问题",
  "AI 回复异常",
  "点数扣除问题",
  "充值或退款问题",
  "功能建议",
  "其他问题",
];

export default function SupportClient({
  supportEmail,
  adminWechat,
}: {
  supportEmail: string;
  adminWechat: string;
}) {
  const [userEmail, setUserEmail] = useState("");
  const [issueType, setIssueType] = useState(issueTypes[0]);
  const [description, setDescription] = useState("");
  const [currentPage, setCurrentPage] = useState("");
  const [feedbackTime, setFeedbackTime] = useState("");
  const [copyText, setCopyText] = useState("复制问题信息");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCurrentPage(document.referrer || window.location.origin);
      setFeedbackTime(
        new Date().toLocaleString("zh-CN", {
          hour12: false,
          timeZone: "Asia/Shanghai",
        })
      );
    }, 0);

    void supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user?.email || "");
    });

    return () => window.clearTimeout(timer);
  }, []);

  const report = useMemo(
    () =>
      [
        "极智岛 AI 问题反馈",
        `问题类型：${issueType}`,
        `登录邮箱：${userEmail || "未登录/请手动填写"}`,
        `发生页面：${currentPage || "请手动填写"}`,
        `问题描述：${description.trim() || "请补充问题现象和操作步骤"}`,
        `反馈时间：${feedbackTime || "提交时自动生成"}`,
      ].join("\n"),
    [currentPage, description, feedbackTime, issueType, userEmail]
  );

  const mailHref = `mailto:${supportEmail}?subject=${encodeURIComponent(
    `极智岛 AI - ${issueType}`
  )}&body=${encodeURIComponent(report)}`;

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report);
      setCopyText("已复制");
      window.setTimeout(() => setCopyText("复制问题信息"), 1600);
    } catch (error) {
      console.error("复制问题信息失败：", error);
      setCopyText("复制失败，请手动复制");
      window.setTimeout(() => setCopyText("复制问题信息"), 2200);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-5 py-8 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <Link href="/" className="text-2xl font-bold">
            极智岛 AI
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              href="/account"
              className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:text-white"
            >
              我的账户
            </Link>
            <Link
              href="/chat"
              className="rounded-lg border border-cyan-400/40 px-4 py-2 font-semibold text-cyan-300 hover:bg-cyan-400/10"
            >
              返回聊天
            </Link>
          </nav>
        </header>

        <section className="py-10">
          <p className="text-sm font-semibold text-cyan-300">帮助与反馈</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            遇到问题？把现场信息交给我们
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
            选择问题类型并简单描述现象，页面会自动整理登录邮箱和发生页面，方便管理员更快定位。
            请勿发送密码、验证码或 API 密钥。
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-xl font-bold">生成问题信息</h2>

            <div className="mt-6 grid gap-5">
              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-slate-200">问题类型</span>
                <select
                  value={issueType}
                  onChange={(event) => setIssueType(event.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-cyan-400"
                >
                  {issueTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm">
                <span className="font-semibold text-slate-200">问题描述</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={6}
                  placeholder="例如：选择 ChatGPT 后发送消息，页面提示内部技术问题。大约发生在今天 14:30。"
                  className="resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 leading-6 outline-none placeholder:text-slate-600 focus:border-cyan-400"
                />
              </label>
            </div>

            <div className="mt-6 whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm leading-7 text-slate-300">
              {report}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={copyReport}
                className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300"
              >
                {copyText}
              </button>
              <a
                href={mailHref}
                className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-white hover:border-cyan-400/60 hover:text-cyan-300"
              >
                用邮箱联系管理员
              </a>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-6">
              <h2 className="text-xl font-bold text-cyan-100">管理员联系方式</h2>
              <div className="mt-5 space-y-4 text-sm">
                <div>
                  <p className="text-cyan-200/70">邮箱</p>
                  <a
                    href={`mailto:${supportEmail}`}
                    className="mt-1 block break-all font-semibold text-white hover:text-cyan-200"
                  >
                    {supportEmail}
                  </a>
                </div>
                <div>
                  <p className="text-cyan-200/70">微信</p>
                  <p className="mt-1 break-all font-semibold text-white">
                    {adminWechat}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 p-6">
              <h2 className="font-bold">反馈时建议提供</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-400">
                <li>• 出现问题的大致时间</li>
                <li>• 使用的功能或 AI 模型</li>
                <li>• 页面显示的错误提示</li>
                <li>• 必要时附上截图</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-800 p-6 text-sm">
              <p className="font-bold">常用入口</p>
              <div className="mt-4 grid gap-3 text-slate-300">
                <Link href="/points" className="hover:text-cyan-300">
                  查看点数明细 →
                </Link>
                <Link href="/refund" className="hover:text-cyan-300">
                  查看充值与退款规则 →
                </Link>
                <Link href="/privacy" className="hover:text-cyan-300">
                  查看隐私政策 →
                </Link>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/60 p-8 text-center shadow-2xl md:p-12">
        <p className="text-sm font-bold tracking-[0.3em] text-cyan-300">404</p>
        <h1 className="mt-4 text-3xl font-bold md:text-4xl">这个页面走丢了</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-400">
          你访问的地址不存在、已被移动，或者链接已经失效。可以返回首页，或继续使用 AI 聊天。
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/"
            className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300"
          >
            返回首页
          </Link>
          <Link
            href="/chat"
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold hover:border-cyan-400/60 hover:text-cyan-300"
          >
            进入 AI 聊天
          </Link>
          <Link
            href="/support"
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:text-white sm:col-span-2"
          >
            帮助与反馈
          </Link>
        </div>
      </section>
    </main>
  );
}

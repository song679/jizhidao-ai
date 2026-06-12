export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl animate-pulse px-6 py-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="h-8 w-32 rounded-lg bg-slate-800" />
          <div className="h-10 w-28 rounded-full bg-slate-800" />
        </div>
        <div className="grid gap-8 py-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-5">
            <div className="h-5 w-24 rounded bg-cyan-900/50" />
            <div className="h-10 w-2/3 rounded bg-slate-800" />
            <div className="h-4 w-full rounded bg-slate-900" />
            <div className="h-4 w-5/6 rounded bg-slate-900" />
          </div>
          <div className="h-80 rounded-3xl border border-slate-800 bg-slate-900/60" />
        </div>
      </div>
    </main>
  );
}

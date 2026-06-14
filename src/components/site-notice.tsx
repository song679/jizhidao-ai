"use client";

import { useCallback, useSyncExternalStore } from "react";

type NoticeLevel = "info" | "warning" | "critical";

type SiteNoticeProps = {
  message: string;
  level: NoticeLevel;
  href: string | null;
  noticeId: string;
};

const levelClasses: Record<NoticeLevel, string> = {
  info: "border-cyan-400/30 bg-cyan-400/10 text-cyan-50",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-50",
  critical: "border-rose-400/40 bg-rose-400/15 text-rose-50",
};

const levelLabels: Record<NoticeLevel, string> = {
  info: "平台公告",
  warning: "服务提醒",
  critical: "重要通知",
};

export function SiteNotice({
  message,
  level,
  href,
  noticeId,
}: SiteNoticeProps) {
  const storageKey = `jizhidao-site-notice:${noticeId}`;
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener("jizhidao-site-notice", callback);
    return () => window.removeEventListener("jizhidao-site-notice", callback);
  }, []);
  const getSnapshot = useCallback(
    () => window.sessionStorage.getItem(storageKey) !== "dismissed",
    [storageKey]
  );
  const getServerSnapshot = useCallback(() => true, []);
  const visible = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  function dismissNotice() {
    window.sessionStorage.setItem(storageKey, "dismissed");
    window.dispatchEvent(new Event("jizhidao-site-notice"));
  }

  if (!visible) return null;

  const externalLink = Boolean(href?.startsWith("https://"));

  return (
    <aside
      className={`relative z-50 border-b px-4 py-3 text-sm ${levelClasses[level]}`}
      role={level === "critical" ? "alert" : "status"}
      aria-label={levelLabels[level]}
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3 pr-8 sm:items-center sm:justify-center">
        <strong className="shrink-0">{levelLabels[level]}</strong>
        <p className="leading-6">
          {message}
          {href && (
            <a
              href={href}
              className="ml-2 whitespace-nowrap font-semibold underline underline-offset-4"
              target={externalLink ? "_blank" : undefined}
              rel={externalLink ? "noreferrer" : undefined}
            >
              查看详情
            </a>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={dismissNotice}
        className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-lg opacity-70 hover:bg-white/10 hover:opacity-100"
        aria-label="关闭公告"
      >
        ×
      </button>
    </aside>
  );
}

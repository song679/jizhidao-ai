import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteNotice } from "@/components/site-notice";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();

function getNoticeLevel() {
  const value = process.env.NEXT_PUBLIC_SITE_NOTICE_LEVEL;

  return value === "warning" || value === "critical" ? value : "info";
}

function getNoticeHref() {
  const value = process.env.NEXT_PUBLIC_SITE_NOTICE_URL?.trim();
  if (!value) return null;

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "极智岛 AI - 中文 AI 聚合平台",
  description:
    "极智岛 AI 是面向中文用户的 AI 聚合平台，支持 AI 聊天、写作、办公、电商文案、短视频脚本等场景，一个账号连接多种 AI 能力。",
  keywords: [
    "极智岛 AI",
    "AI 聚合平台",
    "中文 AI 工具",
    "AI 聊天",
    "AI 写作",
    "AI 办公",
    "AI 电商文案",
    "AI 短视频脚本",
    "DeepSeek",
  ],
  openGraph: {
    title: "极智岛 AI - 中文 AI 聚合平台",
    description:
      "一个账号连接多种 AI 能力，支持聊天、写作、办公、电商文案、短视频脚本等场景。",
    url: siteUrl,
    siteName: "极智岛 AI",
    locale: "zh_CN",
    type: "website",
  },
  icons: {
    icon: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const noticeMessage = process.env.NEXT_PUBLIC_SITE_NOTICE?.trim().slice(
    0,
    500
  );
  const noticeId = noticeMessage
    ? encodeURIComponent(noticeMessage).slice(0, 96)
    : "";

  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {noticeMessage && (
          <SiteNotice
            message={noticeMessage}
            level={getNoticeLevel()}
            href={getNoticeHref()}
            noticeId={noticeId}
          />
        )}
        {children}
      </body>
    </html>
  );
}

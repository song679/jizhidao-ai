import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.jizhidao-ai.com"),
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
    url: "https://www.jizhidao-ai.com",
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
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

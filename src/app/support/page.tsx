import type { Metadata } from "next";
import SupportClient from "./support-client";

export const metadata: Metadata = {
  title: "帮助与反馈 - 极智岛 AI",
  description: "联系极智岛 AI 管理员，反馈登录、AI 回复、点数和充值问题。",
};

function firstConfiguredEmail() {
  const configured =
    process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";
  return configured
    .split(",")
    .map((email) => email.trim())
    .find(Boolean);
}

export default function SupportPage() {
  const supportEmail = firstConfiguredEmail() || "songzhewen1997@126.com";
  const adminWechat =
    process.env.NEXT_PUBLIC_ADMIN_WECHAT || "请通过管理员邮箱联系";

  return (
    <SupportClient
      supportEmail={supportEmail}
      adminWechat={adminWechat}
    />
  );
}

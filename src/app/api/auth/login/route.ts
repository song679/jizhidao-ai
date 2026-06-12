import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PRODUCTION_SITE_URL = "https://www.jizhidao-ai.com";

function normalizeSiteUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const url = new URL(
      value.startsWith("http://") || value.startsWith("https://")
        ? value
        : `https://${value}`
    );

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function getLoginRedirectOrigin(requestUrl: URL) {
  const configuredSiteUrl = normalizeSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL
  );
  const requestOrigin = normalizeSiteUrl(requestUrl.origin);
  const requestIsLocal =
    requestUrl.hostname === "localhost" ||
    requestUrl.hostname === "127.0.0.1";
  const configuredIsLocal =
    configuredSiteUrl?.includes("localhost") ||
    configuredSiteUrl?.includes("127.0.0.1");
  const requestIsProductionDomain =
    requestUrl.hostname === "www.jizhidao-ai.com" ||
    requestUrl.hostname === "jizhidao-ai.com";

  if (!requestIsLocal) {
    if (requestIsProductionDomain) {
      return PRODUCTION_SITE_URL;
    }

    if (configuredSiteUrl && !configuredIsLocal) {
      return configuredSiteUrl;
    }

    return requestOrigin || PRODUCTION_SITE_URL;
  }

  return configuredSiteUrl || requestOrigin || "http://localhost:3000";
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "登录服务配置不完整，请联系管理员" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "请输入正确的邮箱地址" },
        { status: 400 }
      );
    }

    const requestUrl = new URL(request.url);
    const siteUrl = getLoginRedirectOrigin(requestUrl);
    const callbackUrl = new URL("/auth/callback", siteUrl);
    callbackUrl.searchParams.set("next", "/chat?welcome=1");
    const emailRedirectTo = callbackUrl.toString();
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
        shouldCreateUser: true,
      },
    });

    if (error) {
      console.error("发送登录邮件失败：", error.message);

      if (error.status === 429) {
        return NextResponse.json(
          { error: "发送次数过多，请稍后再试" },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: "登录邮件发送失败，请稍后再试或联系管理员",
          diagnosticCode: error.code || `auth_status_${error.status || 500}`,
        },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json({
      message: "登录链接已发送到你的邮箱，请打开邮箱点击链接登录。",
      redirectHost: new URL(emailRedirectTo).host,
    });
  } catch (error) {
    console.error("Login API Error:", error);

    return NextResponse.json(
      { error: "当前登录服务暂时不可用，请稍后再试" },
      { status: 500 }
    );
  }
}

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type AdminAuthorization =
  | {
      error: NextResponse;
      adminEmail: null;
      supabaseAdmin: null;
    }
  | {
      error: null;
      adminEmail: string;
      supabaseAdmin: SupabaseClient;
    };

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function authorizeAdmin(
  request: Request
): Promise<AdminAuthorization> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseSecretKey) {
    return {
      error: NextResponse.json(
        { error: "服务器环境变量配置不完整" },
        { status: 500 }
      ),
      adminEmail: null,
      supabaseAdmin: null,
    };
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { error: "请先登录管理员账号" },
        { status: 401 }
      ),
      adminEmail: null,
      supabaseAdmin: null,
    };
  }

  const adminEmails = getAdminEmails();

  if (adminEmails.length === 0) {
    return {
      error: NextResponse.json(
        { error: "服务器未配置管理员账号" },
        { status: 500 }
      ),
      adminEmail: null,
      supabaseAdmin: null,
    };
  }

  const accessToken = authorization.slice("Bearer ".length);
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
  const {
    data: { user: adminUser },
    error: adminUserError,
  } = await supabaseAuth.auth.getUser(accessToken);

  if (adminUserError || !adminUser?.email) {
    return {
      error: NextResponse.json(
        { error: "管理员登录状态无效，请重新登录" },
        { status: 401 }
      ),
      adminEmail: null,
      supabaseAdmin: null,
    };
  }

  if (!adminEmails.includes(adminUser.email.toLowerCase())) {
    return {
      error: NextResponse.json(
        { error: "当前账号没有管理员权限" },
        { status: 403 }
      ),
      adminEmail: null,
      supabaseAdmin: null,
    };
  }

  return {
    error: null,
    adminEmail: adminUser.email,
    supabaseAdmin: createClient(supabaseUrl, supabaseSecretKey),
  };
}

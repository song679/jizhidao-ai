import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function DELETE(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseSecretKey) {
      return NextResponse.json(
        { error: "服务器未配置完整的账户服务" },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "请先登录后再注销账号" },
        { status: 401 }
      );
    }

    const accessToken = authorization.slice("Bearer ".length);
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(accessToken);

    if (userError || !user || !user.email) {
      return NextResponse.json(
        { error: "登录状态无效，请重新登录" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const confirmationEmail =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const userEmail = user.email.trim().toLowerCase();

    if (confirmationEmail !== userEmail) {
      return NextResponse.json(
        { error: "确认邮箱与当前登录账号不一致" },
        { status: 400 }
      );
    }

    if (getAdminEmails().includes(userEmail)) {
      return NextResponse.json(
        { error: "管理员账号不能在前台注销，请先移除管理员权限" },
        { status: 403 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const userDataDeletes = [
      { table: "chat_messages", column: "user_id" },
      { table: "chat_sessions", column: "user_id" },
      { table: "chat_request_ledger", column: "user_id" },
      { table: "point_transactions", column: "user_id" },
      { table: "user_points", column: "id" },
    ];

    for (const target of userDataDeletes) {
      const { error } = await supabaseAdmin
        .from(target.table)
        .delete()
        .eq(target.column, user.id);

      if (error) {
        console.error(`删除 ${target.table} 数据失败：`, error.message);
        return NextResponse.json(
          { error: "删除账户数据失败，请稍后重试或联系管理员" },
          { status: 500 }
        );
      }
    }

    const { error: deleteUserError } =
      await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      console.error("删除认证账号失败：", deleteUserError.message);
      return NextResponse.json(
        { error: "账户数据已清理，但认证账号注销失败，请联系管理员" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Account Delete API Error:", error);
    return NextResponse.json(
      { error: "注销账号失败，请稍后重试或联系管理员" },
      { status: 500 }
    );
  }
}

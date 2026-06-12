import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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
        { error: "请先登录后导出个人数据" },
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

    if (userError || !user) {
      return NextResponse.json(
        { error: "登录状态无效，请重新登录" },
        { status: 401 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const [pointsResult, transactionsResult, sessionsResult, messagesResult] =
      await Promise.all([
        supabaseAdmin
          .from("user_points")
          .select("email, points")
          .eq("id", user.id)
          .maybeSingle(),
        supabaseAdmin
          .from("point_transactions")
          .select(
            "id, change_amount, balance_after, type, description, created_at"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(5000),
        supabaseAdmin
          .from("chat_sessions")
          .select("id, title, created_at, updated_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(5000),
        supabaseAdmin
          .from("chat_messages")
          .select("id, session_id, role, content, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(5000),
      ]);

    const queryError =
      pointsResult.error ||
      transactionsResult.error ||
      sessionsResult.error ||
      messagesResult.error;

    if (queryError) {
      console.error("导出个人数据查询失败：", queryError.message);
      return NextResponse.json(
        { error: "生成个人数据文件失败，请稍后再试" },
        { status: 500 }
      );
    }

    const exportedAt = new Date();
    const exportData = {
      export_info: {
        service: "极智岛 AI",
        exported_at: exportedAt.toISOString(),
        format_version: 1,
        record_limit_per_category: 5000,
        note: "该文件包含你的个人账户数据，请妥善保存，不要发送给无关人员。",
      },
      account: {
        id: user.id,
        email: user.email || null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at || null,
      },
      points: pointsResult.data || {
        email: user.email || null,
        points: 1000,
      },
      point_transactions: transactionsResult.data || [],
      chat_sessions: sessionsResult.data || [],
      chat_messages: messagesResult.data || [],
    };

    const date = exportedAt.toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="jizhidao-ai-data-${date}.json"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Account Data Export API Error:", error);
    return NextResponse.json(
      { error: "生成个人数据文件失败，请稍后再试" },
      { status: 500 }
    );
  }
}

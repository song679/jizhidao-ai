import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseSecretKey) {
    return null;
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseSecretKey,
  };
}

async function getUserFromRequest(request: Request) {
  const env = getEnv();

  if (!env) {
    return {
      error: NextResponse.json(
        { error: "服务器未配置 Supabase 环境变量" },
        { status: 500 }
      ),
      user: null,
      supabaseAdmin: null,
    };
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { error: "请先登录后使用会话功能" },
        { status: 401 }
      ),
      user: null,
      supabaseAdmin: null,
    };
  }

  const accessToken = authorization.replace("Bearer ", "");

  const supabaseAuth = createClient(env.supabaseUrl, env.supabaseAnonKey);

  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser(accessToken);

  if (userError || !user) {
    return {
      error: NextResponse.json(
        { error: "登录状态无效，请重新登录" },
        { status: 401 }
      ),
      user: null,
      supabaseAdmin: null,
    };
  }

  const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseSecretKey);

  return {
    error: null,
    user,
    supabaseAdmin,
  };
}

export async function GET(request: Request) {
  try {
    const { error, user, supabaseAdmin } = await getUserFromRequest(request);

    if (error || !user || !supabaseAdmin) {
      return error;
    }

    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from("chat_sessions")
      .select("id, title, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (sessionsError) {
      console.error("查询历史会话失败：", sessionsError.message);
      return NextResponse.json(
        { error: "查询历史会话失败" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessions: sessions || [],
    });
  } catch (error) {
    console.error("Get Chat Sessions Error:", error);

    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { error, user, supabaseAdmin } = await getUserFromRequest(request);

    if (error || !user || !supabaseAdmin) {
      return error;
    }

    const body = await request.json().catch(() => ({}));
    const title = typeof body?.title === "string" && body.title.trim()
      ? body.title.trim()
      : "新聊天";

    const { data: session, error: insertError } = await supabaseAdmin
      .from("chat_sessions")
      .insert({
        user_id: user.id,
        email: user.email,
        title,
      })
      .select("id, title, created_at, updated_at")
      .single();

    if (insertError) {
      console.error("创建聊天会话失败：", insertError.message);
      return NextResponse.json(
        { error: "创建聊天会话失败" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      session,
    });
  } catch (error) {
    console.error("Create Chat Session Error:", error);

    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { error, user, supabaseAdmin } = await getUserFromRequest(request);

    if (error || !user || !supabaseAdmin) {
      return error;
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id")?.trim();

    if (!sessionId) {
      return NextResponse.json(
        { error: "缺少要删除的会话标识" },
        { status: 400 }
      );
    }

    const { data: ownedSession, error: sessionQueryError } =
      await supabaseAdmin
        .from("chat_sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (sessionQueryError) {
      console.error("查询聊天会话失败：", sessionQueryError.message);
      return NextResponse.json(
        { error: "查询聊天会话失败" },
        { status: 500 }
      );
    }

    if (!ownedSession) {
      return NextResponse.json(
        { error: "没有找到该聊天会话" },
        { status: 404 }
      );
    }

    const { error: messagesDeleteError } = await supabaseAdmin
      .from("chat_messages")
      .delete()
      .eq("session_id", sessionId)
      .eq("user_id", user.id);

    if (messagesDeleteError) {
      console.error("删除会话消息失败：", messagesDeleteError.message);
      return NextResponse.json(
        { error: "删除会话消息失败" },
        { status: 500 }
      );
    }

    const { error: sessionDeleteError } = await supabaseAdmin
      .from("chat_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (sessionDeleteError) {
      console.error("删除聊天会话失败：", sessionDeleteError.message);
      return NextResponse.json(
        { error: "删除聊天会话失败" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId,
    });
  } catch (error) {
    console.error("Delete Chat Session Error:", error);

    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "服务器未配置 Supabase 公开环境变量" },
        { status: 500 }
      );
    }

    if (!supabaseSecretKey) {
      return NextResponse.json(
        { error: "服务器未配置 SUPABASE_SECRET_KEY" },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "请先登录后查看聊天记录" },
        { status: 401 }
      );
    }

    const accessToken = authorization.replace("Bearer ", "");

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

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

    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    let query = supabaseAdmin
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("user_id", user.id);

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    const { data: messages, error: messagesError } = await query
      .order("created_at", { ascending: false })
      .limit(20);

    if (messagesError) {
      return NextResponse.json(
        { error: "查询聊天记录失败", detail: messagesError.message },
        { status: 500 }
      );
    }

    const formattedMessages = (messages || [])
      .reverse()
      .map((item) => ({
        role: item.role,
        content: item.content,
      }));

    return NextResponse.json({
      messages: formattedMessages,
    });
  } catch (error) {
    console.error("Chat History API Error:", error);

    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "服务器未配置 Supabase 公开环境变量" },
        { status: 500 }
      );
    }

    if (!supabaseSecretKey) {
      return NextResponse.json(
        { error: "服务器未配置 SUPABASE_SECRET_KEY" },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "请先登录后清空聊天记录" },
        { status: 401 }
      );
    }

    const accessToken = authorization.replace("Bearer ", "");

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

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

    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");

    let deleteQuery = supabaseAdmin
      .from("chat_messages")
      .delete()
      .eq("user_id", user.id);

    if (sessionId) {
      deleteQuery = deleteQuery.eq("session_id", sessionId);
    }

    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      return NextResponse.json(
        { error: "清空聊天记录失败", detail: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "聊天记录已清空",
    });
  } catch (error) {
    console.error("Delete Chat History API Error:", error);

    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}
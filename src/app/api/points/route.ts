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
        { error: "请先登录后查看点数明细" },
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

    const { error: recoveryError } = await supabaseAdmin.rpc(
      "recover_stale_chat_reservations",
      {
        p_user_id: user.id,
        p_stale_seconds: 600,
      }
    );

    if (recoveryError && recoveryError.code !== "PGRST202") {
      console.error("恢复超时预扣点数失败：", recoveryError.message);
    }

    const { data: existingPoints, error: pointsQueryError } =
      await supabaseAdmin
        .from("user_points")
        .select("id, email, points")
        .eq("id", user.id)
        .single();

    if (pointsQueryError && pointsQueryError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "查询用户点数失败", detail: pointsQueryError.message },
        { status: 500 }
      );
    }

    let currentPoints = existingPoints?.points ?? 1000;

    if (!existingPoints) {
      const { error: insertError } = await supabaseAdmin
        .from("user_points")
        .insert({
          id: user.id,
          email: user.email,
          points: 1000,
        });

      if (insertError) {
        return NextResponse.json(
          { error: "初始化用户点数失败", detail: insertError.message },
          { status: 500 }
        );
      }

      const { error: transactionError } = await supabaseAdmin
        .from("point_transactions")
        .insert({
          user_id: user.id,
          email: user.email,
          change_amount: 1000,
          balance_after: 1000,
          type: "gift",
          description: "新用户注册赠送 1000 点",
        });

      if (transactionError) {
        console.error("写入新用户赠送流水失败：", transactionError.message);
      }

      currentPoints = 1000;
    }

    const { data: transactions, error: transactionQueryError } =
      await supabaseAdmin
        .from("point_transactions")
        .select("id, change_amount, balance_after, type, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

    if (transactionQueryError) {
      return NextResponse.json(
        {
          error: "查询点数流水失败",
          detail: transactionQueryError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      email: user.email,
      points: currentPoints,
      transactions: transactions || [],
    });
  } catch (error) {
    console.error("Points API Error:", error);

    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}

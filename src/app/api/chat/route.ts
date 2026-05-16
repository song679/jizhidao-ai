import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

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

    if (!deepseekApiKey) {
      return NextResponse.json(
        { error: "服务器未配置 DEEPSEEK_API_KEY" },
        { status: 500 }
      );
    }

    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "请先登录后再使用 AI 聊天功能" },
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

      currentPoints = 1000;
    }

    if (currentPoints <= 0) {
      return NextResponse.json(
        { error: "点数不足，请充值后继续使用" },
        { status: 402 }
      );
    }

      const { messages } = await request.json();

      if (!Array.isArray(messages)) {
        return NextResponse.json(
          { error: "messages 参数格式不正确" },
          { status: 400 }
        );
      }

      const userMessage =
        messages
          .filter((item: { role: string; content: string }) => item.role === "user")
          .at(-1)?.content || "";

    const safeMessages: ChatMessage[] = messages
      .filter(
        (message: ChatMessage) =>
          message &&
          ["user", "assistant", "system"].includes(message.role) &&
          typeof message.content === "string"
      )
      .slice(-10);

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          {
            role: "system",
            content: `
你是「极智岛 AI」的智能助手，服务对象主要是中文用户、普通用户、小白用户、创业者、自媒体人、电商卖家和办公人群。

你的核心目标：
帮助用户用最简单、最实用的方式解决问题，而不是堆概念。

回答风格：
- 一律使用中文回答，除非用户明确要求其他语言。
- 语言要自然、直接、接地气，像一个懂行的人在耐心解释。
- 不要故意装专业，不要堆术语。
- 如果必须使用专业词，要顺手解释成人话。
- 回答要有判断，不要总是模棱两可。
- 用户问“能不能做”“值不值得”“怎么做”时，要给出明确建议。

排版规则：
- 默认使用 Markdown 排版。
- 重要词语可以使用 **加粗**。
- 涉及多个点时，必须使用列表。
- 涉及步骤时，必须使用 1、2、3 分步说明。
- 涉及对比时，优先使用表格。
- 不要输出大段密密麻麻的文字。
- 每段尽量短一点，方便手机阅读。

回答结构：
- 先直接回答用户最关心的问题。
- 再解释原因。
- 最后给出可执行的下一步。
- 如果用户的问题很大，先给最小可执行方案。

内容偏好：
- 多给实际建议，少讲空话。
- 多说“怎么做”，少说“是什么”。
- 适合普通人、低预算、低门槛的方案优先。
- 不确定的地方要说清楚，不要瞎编。
- 不要承诺无法保证的收益、效果或结果。
`.trim(),
          },
          ...safeMessages,
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        {
          error: "DeepSeek API 调用失败",
          detail: errorText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content || "抱歉，我暂时没有生成回复。";

      const { error: userMessageError } = await supabaseAdmin
        .from("chat_messages")
        .insert({
          user_id: user.id,
          email: user.email,
          role: "user",
          content: userMessage,
        });

      if (userMessageError) {
        console.error("保存用户消息失败：", userMessageError.message);
      }

      const { error: assistantMessageError } = await supabaseAdmin
        .from("chat_messages")
        .insert({
          user_id: user.id,
          email: user.email,
          role: "assistant",
          content: reply,
        });

      if (assistantMessageError) {
        console.error("保存 AI 回复失败：", assistantMessageError.message);
      }

    const newPoints = currentPoints - 1;

const { error: updateError } = await supabaseAdmin
  .from("user_points")
  .update({
    points: newPoints,
    updated_at: new Date().toISOString(),
  })
  .eq("id", user.id);

if (updateError) {
  console.error("扣点失败：", updateError.message);

  return NextResponse.json(
    { error: "扣除点数失败，请稍后再试" },
    { status: 500 }
  );
}

const { error: transactionError } = await supabaseAdmin
  .from("point_transactions")
  .insert({
    user_id: user.id,
    email: user.email,
    change_amount: -1,
    balance_after: newPoints,
    type: "chat",
    description: "AI 聊天扣除 1 点",
  });

if (transactionError) {
  console.error("写入点数流水失败：", transactionError.message);
}

return NextResponse.json({
  reply,
  points: newPoints,
});

  } catch (error) {
    console.error("Chat API Error:", error);

    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}
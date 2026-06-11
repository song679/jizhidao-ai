import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AiProvider = "deepseek" | "openai";

type ModelOption = {
  id: string;
  provider: AiProvider;
  model: string;
  displayName: string;
  pointCost: number;
};

const SYSTEM_PROMPT = `
你是「极智岛 AI」的智能助手，服务对象主要是中文用户、普通用户、小白用户、创业者、自媒体人、电商卖家和办公人群。

你的核心目标：
帮助用户用最简单、最实用的方式解决问题，而不是堆概念。

回答风格：
- 一律使用中文回答，除非用户明确要求其他语言。
- 语言要自然、直接、接地气。
- 不要故意装专业，不要堆术语。
- 如果必须使用专业词，要顺手解释成人话。
- 回答要有判断，不要总是模棱两可。

排版规则：
- 默认使用 Markdown 排版。
- 涉及多个要点时，使用列表。
- 涉及步骤时，使用 1. 2. 3. 分步说明。
- 涉及对比时，优先使用表格。
- 每段尽量短一点，方便手机阅读。

回答结构：
- 先直接回答用户最关心的问题。
- 再解释原因。
- 最后给出可执行的下一步。
- 如果用户的问题很大，先给最小可执行方案。
`.trim();

function parseModelList(value: string | undefined, fallback: string) {
  const models = value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return models && models.length > 0 ? models : [fallback];
}

function parsePointCost(value: string | undefined, fallback: number) {
  const pointCost = Number(value);

  return Number.isInteger(pointCost) && pointCost > 0 ? pointCost : fallback;
}

function getModelOptions(): ModelOption[] {
  const openaiModels = parseModelList(
    process.env.OPENAI_MODEL_OPTIONS,
    process.env.OPENAI_MODEL || "chat-latest"
  );
  const deepseekModels = parseModelList(
    process.env.DEEPSEEK_MODEL_OPTIONS,
    process.env.DEEPSEEK_MODEL || "deepseek-v4-flash"
  );
  const openaiPointCost = parsePointCost(process.env.OPENAI_POINT_COST, 2);
  const deepseekPointCost = parsePointCost(process.env.DEEPSEEK_POINT_COST, 1);

  return [
    ...openaiModels.map((model) => ({
      id: `openai:${model}`,
      provider: "openai" as const,
      model,
      displayName: "ChatGPT",
      pointCost: openaiPointCost,
    })),
    ...deepseekModels.map((model) => ({
      id: `deepseek:${model}`,
      provider: "deepseek" as const,
      model,
      displayName: "DeepSeek",
      pointCost: deepseekPointCost,
    })),
  ];
}

function resolveModelSelection(body: {
  modelId?: unknown;
  provider?: unknown;
  model?: unknown;
}) {
  const options = getModelOptions();
  const defaultProvider =
    process.env.AI_PROVIDER === "openai" ? "openai" : "deepseek";
  const defaultModel =
    defaultProvider === "openai"
      ? process.env.OPENAI_MODEL || "chat-latest"
      : process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

  const selectedById =
    typeof body.modelId === "string"
      ? options.find((option) => option.id === body.modelId)
      : null;

  if (selectedById) {
    return selectedById;
  }

  const selectedByProviderAndModel =
    (body.provider === "openai" || body.provider === "deepseek") &&
    typeof body.model === "string"
      ? options.find(
          (option) =>
            option.provider === body.provider && option.model === body.model
        )
      : null;

  if (selectedByProviderAndModel) {
    return selectedByProviderAndModel;
  }

  return (
    options.find(
      (option) =>
        option.provider === defaultProvider && option.model === defaultModel
    ) ||
    options.find((option) => option.provider === defaultProvider) ||
    options[0]
  );
}

function getSafeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter(
      (message): message is ChatMessage =>
        message &&
        typeof message === "object" &&
        "role" in message &&
        "content" in message &&
        ["user", "assistant", "system"].includes(String(message.role)) &&
        typeof message.content === "string"
    )
    .slice(-10);
}

async function callDeepSeek(messages: ChatMessage[], model: string) {
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

  if (!deepseekApiKey) {
    return {
      error: NextResponse.json(
        { error: "服务器未配置 DEEPSEEK_API_KEY" },
        { status: 500 }
      ),
      reply: "",
    };
  }

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${deepseekApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1000,
      stream: false,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();

    return {
      error: NextResponse.json(
        {
          error: "DeepSeek API 调用失败",
          detail,
        },
        { status: response.status }
      ),
      reply: "",
    };
  }

  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content || "";

  return {
    error: null,
    reply: reply || "抱歉，我暂时没有生成回复。",
  };
}

async function callOpenAI(messages: ChatMessage[], model: string) {
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!openaiApiKey) {
    return {
      error: NextResponse.json(
        { error: "服务器未配置 OPENAI_API_KEY" },
        { status: 500 }
      ),
      reply: "",
    };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        ...messages,
      ],
      temperature: 0.7,
      max_completion_tokens: 1000,
      stream: false,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();

    return {
      error: NextResponse.json(
        {
          error: "OpenAI API 调用失败",
          detail,
        },
        { status: response.status }
      ),
      reply: "",
    };
  }

  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content || "";

  return {
    error: null,
    reply: reply || "抱歉，我暂时没有生成回复。",
  };
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const safeMessages = getSafeMessages(body.messages);

    if (safeMessages.length === 0) {
      return NextResponse.json(
        { error: "messages 参数格式不正确" },
        { status: 400 }
      );
    }

    const chatSessionId =
      typeof body.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim()
        : null;

    const userMessage =
      safeMessages.filter((item) => item.role === "user").at(-1)?.content || "";

    const selectedModel = resolveModelSelection(body);
    const provider = selectedModel.provider;
    const pointCost = selectedModel.pointCost;

    if (currentPoints < pointCost) {
      return NextResponse.json(
        {
          error: `当前模型每次需要 ${pointCost} 点，余额不足，请充值或切换其他模型`,
          requiredPoints: pointCost,
          points: currentPoints,
        },
        { status: 402 }
      );
    }

    const aiResult =
      provider === "openai"
        ? await callOpenAI(safeMessages, selectedModel.model)
        : await callDeepSeek(safeMessages, selectedModel.model);

    if (aiResult.error) {
      return aiResult.error;
    }

    const reply = aiResult.reply;

    const { error: userMessageError } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        user_id: user.id,
        email: user.email,
        role: "user",
        content: userMessage,
        session_id: chatSessionId,
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
        session_id: chatSessionId,
      });

    if (assistantMessageError) {
      console.error("保存 AI 回复失败：", assistantMessageError.message);
    }

    if (chatSessionId) {
      const titleFromMessage =
        userMessage.length > 20 ? `${userMessage.slice(0, 20)}...` : userMessage;

      const { data: currentSession } = await supabaseAdmin
        .from("chat_sessions")
        .select("title")
        .eq("id", chatSessionId)
        .eq("user_id", user.id)
        .single();

      const nextTitle =
        currentSession?.title === "新聊天" && titleFromMessage
          ? titleFromMessage
          : currentSession?.title || "新聊天";

      const { error: sessionUpdateError } = await supabaseAdmin
        .from("chat_sessions")
        .update({
          title: nextTitle,
          updated_at: new Date().toISOString(),
        })
        .eq("id", chatSessionId)
        .eq("user_id", user.id);

      if (sessionUpdateError) {
        console.error("更新聊天会话失败：", sessionUpdateError.message);
      }
    }

    const newPoints = currentPoints - pointCost;

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
        change_amount: -pointCost,
        balance_after: newPoints,
        type: "chat",
        description: `${selectedModel.displayName} 聊天扣除 ${pointCost} 点`,
      });

    if (transactionError) {
      console.error("写入点数流水失败：", transactionError.message);
    }

    return NextResponse.json({
      reply,
      points: newPoints,
      sessionId: chatSessionId,
      provider,
      model: selectedModel.model,
      modelId: selectedModel.id,
      displayName: selectedModel.displayName,
      pointCost,
    });
  } catch (error) {
    console.error("Chat API Error:", error);

    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}

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

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
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
    signal: AbortSignal.timeout(60_000),
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
    signal: AbortSignal.timeout(60_000),
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
    const requestId = body.requestId;

    if (!isUuid(requestId)) {
      return NextResponse.json(
        { error: "请求标识无效，请刷新页面后重试" },
        { status: 400 }
      );
    }

    const rateLimit = parsePositiveInteger(process.env.CHAT_RATE_LIMIT, 10);
    const rateWindowSeconds = parsePositiveInteger(
      process.env.CHAT_RATE_WINDOW_SECONDS,
      60
    );
    const { data: reservation, error: reservationError } =
      await supabaseAdmin.rpc("reserve_chat_points", {
        p_request_id: requestId,
        p_user_id: user.id,
        p_email: user.email || "",
        p_point_cost: pointCost,
        p_model_name: `${selectedModel.displayName} - ${selectedModel.model}`,
        p_rate_limit: rateLimit,
        p_window_seconds: rateWindowSeconds,
      });

    if (reservationError) {
      console.error("预扣点数失败：", reservationError.message);

      return NextResponse.json(
        { error: "点数安全服务暂时不可用，请联系管理员" },
        { status: 503 }
      );
    }

    if (reservation?.status === "duplicate") {
      return NextResponse.json(
        { error: "该请求已经处理，请勿重复提交" },
        { status: 409 }
      );
    }

    if (reservation?.status === "rate_limited") {
      return NextResponse.json(
        {
          error: "发送过于频繁，请稍后再试",
          retryAfter: reservation.retryAfter || rateWindowSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              reservation.retryAfter || rateWindowSeconds
            ),
          },
        }
      );
    }

    if (reservation?.status === "insufficient_points") {
      return NextResponse.json(
        {
          error: `当前模型每次需要 ${pointCost} 点，余额不足，请充值或切换其他模型`,
          requiredPoints: pointCost,
          points: reservation.points,
        },
        { status: 402 }
      );
    }

    if (reservation?.status !== "reserved") {
      return NextResponse.json(
        { error: "无法确认点数预扣状态，请稍后再试" },
        { status: 500 }
      );
    }

    async function refundReservation() {
      const { error: refundError } = await supabaseAdmin.rpc(
        "refund_chat_request",
        {
          p_request_id: requestId,
        }
      );

      if (refundError) {
        console.error("退还预扣点数失败：", refundError.message);
      }
    }

    try {
      const aiResult =
        provider === "openai"
          ? await callOpenAI(safeMessages, selectedModel.model)
          : await callDeepSeek(safeMessages, selectedModel.model);

      if (aiResult.error) {
        await refundReservation();
        return aiResult.error;
      }

      const reply = aiResult.reply;
      const { data: completion, error: completionError } =
        await supabaseAdmin.rpc("complete_chat_request", {
          p_request_id: requestId,
          p_description: `${selectedModel.displayName} 聊天扣除 ${pointCost} 点`,
        });

      if (completionError || completion?.status !== "completed") {
        console.error(
          "完成聊天扣点失败：",
          completionError?.message || completion?.status
        );
        await refundReservation();

        return NextResponse.json(
          { error: "完成点数结算失败，本次预扣点数已退还" },
          { status: 500 }
        );
      }

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
          userMessage.length > 20
            ? `${userMessage.slice(0, 20)}...`
            : userMessage;

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

      return NextResponse.json({
        reply,
        points: completion.points,
        sessionId: chatSessionId,
        provider,
        model: selectedModel.model,
        modelId: selectedModel.id,
        displayName: selectedModel.displayName,
        pointCost,
        requestId,
      });
    } catch (error) {
      await refundReservation();
      throw error;
    }
  } catch (error) {
    console.error("Chat API Error:", error);

    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}

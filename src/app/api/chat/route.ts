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

const MAX_MESSAGE_LENGTH = 8_000;
const MAX_TOTAL_MESSAGE_LENGTH = 24_000;
const MAX_REQUEST_BYTES = 128_000;

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

function getSafeMessages(messages: unknown): {
  messages: ChatMessage[];
  error: string | null;
} {
  if (!Array.isArray(messages)) {
    return {
      messages: [],
      error: "messages 参数格式不正确",
    };
  }

  const safeMessages = messages
    .filter(
      (message): message is ChatMessage =>
        message &&
        typeof message === "object" &&
        "role" in message &&
        "content" in message &&
        ["user", "assistant"].includes(String(message.role)) &&
        typeof message.content === "string"
    )
    .slice(-10)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0);

  if (safeMessages.length === 0) {
    return {
      messages: [],
      error: "请输入有效的聊天内容",
    };
  }

  if (safeMessages.some((message) => message.content.length > MAX_MESSAGE_LENGTH)) {
    return {
      messages: [],
      error: `单条消息不能超过 ${MAX_MESSAGE_LENGTH} 个字符`,
    };
  }

  const totalLength = safeMessages.reduce(
    (total, message) => total + message.content.length,
    0
  );

  if (totalLength > MAX_TOTAL_MESSAGE_LENGTH) {
    return {
      messages: [],
      error: "当前对话内容过长，请新建聊天后继续",
    };
  }

  return {
    messages: safeMessages,
    error: null,
  };
}

async function openProviderStream(
  provider: AiProvider,
  messages: ChatMessage[],
  model: string,
  signal: AbortSignal
) {
  const isOpenAI = provider === "openai";
  const apiKey = isOpenAI
    ? process.env.OPENAI_API_KEY
    : process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return {
      response: null,
      error: `服务器未配置 ${isOpenAI ? "OPENAI_API_KEY" : "DEEPSEEK_API_KEY"}`,
      status: 500,
    };
  }

  const response = await fetch(
    isOpenAI
      ? "https://api.openai.com/v1/chat/completions"
      : "https://api.deepseek.com/chat/completions",
    {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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
        ...(isOpenAI
          ? { max_completion_tokens: 1000 }
          : { max_tokens: 1000 }),
        stream: true,
      }),
    }
  );

  if (!response.ok || !response.body) {
    const detail = await response.text();
    console.error(`${isOpenAI ? "OpenAI" : "DeepSeek"} API 调用失败：`, detail);

    return {
      response: null,
      error: "当前 AI 模型暂时无法响应，请稍后重试或切换模型",
      status: response.status || 502,
    };
  }

  return {
    response,
    error: null,
    status: 200,
  };
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);

    if (contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        { error: "本次发送内容过大，请精简后重试" },
        { status: 413 }
      );
    }

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

    const userId = user.id;
    const userEmail = user.email;
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey);

    const body = await request.json();
    const messageResult = getSafeMessages(body.messages);
    const safeMessages = messageResult.messages;

    if (messageResult.error) {
      return NextResponse.json(
        { error: messageResult.error },
        { status: 400 }
      );
    }

    const userMessage =
      safeMessages.filter((item) => item.role === "user").at(-1)?.content || "";

    if (!userMessage) {
      return NextResponse.json(
        { error: "缺少要发送的用户消息" },
        { status: 400 }
      );
    }

    const selectedModel = resolveModelSelection(body);
    const provider = selectedModel.provider;
    const pointCost = selectedModel.pointCost;
    const requestId = body.requestId;
    const isRegeneration = body.regenerate === true;

    if (!isUuid(requestId)) {
      return NextResponse.json(
        { error: "请求标识无效，请刷新页面后重试" },
        { status: 400 }
      );
    }

    const requestedSessionId =
      typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    let chatSessionId = requestedSessionId;

    if (requestedSessionId) {
      if (!isUuid(requestedSessionId)) {
        return NextResponse.json(
          { error: "聊天会话标识无效，请刷新页面后重试" },
          { status: 400 }
        );
      }

      const { data: ownedSession, error: sessionQueryError } =
        await supabaseAdmin
          .from("chat_sessions")
          .select("id")
          .eq("id", requestedSessionId)
          .eq("user_id", user.id)
          .maybeSingle();

      if (sessionQueryError) {
        console.error("校验聊天会话失败：", sessionQueryError.message);
        return NextResponse.json(
          { error: "聊天会话校验失败，请稍后重试" },
          { status: 500 }
        );
      }

      if (!ownedSession) {
        return NextResponse.json(
          { error: "聊天会话不存在或不属于当前账号，请刷新后重试" },
          { status: 404 }
        );
      }
    } else {
      const { data: newSession, error: sessionCreateError } =
        await supabaseAdmin
          .from("chat_sessions")
          .insert({
            user_id: user.id,
            email: user.email,
            title: "新聊天",
          })
          .select("id")
          .single();

      if (sessionCreateError || !newSession) {
        console.error("自动创建聊天会话失败：", sessionCreateError?.message);
        return NextResponse.json(
          { error: "创建聊天会话失败，请刷新后重试" },
          { status: 500 }
        );
      }

      chatSessionId = newSession.id;
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

    async function completeAndSave(reply: string) {
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
        throw new Error("完成点数结算失败，本次预扣点数已退还");
      }

      let messagesError = null;

      if (isRegeneration) {
        const { data: previousAssistant, error: previousAssistantError } =
          await supabaseAdmin
            .from("chat_messages")
            .select("id")
            .eq("session_id", chatSessionId)
            .eq("user_id", userId)
            .eq("role", "assistant")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (previousAssistantError) {
          messagesError = previousAssistantError;
        } else if (previousAssistant) {
          const { error } = await supabaseAdmin
            .from("chat_messages")
            .update({ content: reply })
            .eq("id", previousAssistant.id)
            .eq("user_id", userId);
          messagesError = error;
        } else {
          const { error } = await supabaseAdmin.from("chat_messages").insert({
            user_id: userId,
            email: userEmail,
            role: "assistant",
            content: reply,
            session_id: chatSessionId,
          });
          messagesError = error;
        }
      } else {
        const { error } = await supabaseAdmin.from("chat_messages").insert([
          {
            user_id: userId,
            email: userEmail,
            role: "user",
            content: userMessage,
            session_id: chatSessionId,
          },
          {
            user_id: userId,
            email: userEmail,
            role: "assistant",
            content: reply,
            session_id: chatSessionId,
          },
        ]);
        messagesError = error;
      }

      if (messagesError) {
        console.error("保存聊天消息失败：", messagesError.message);
      }

      const titleFromMessage =
        userMessage.length > 20
          ? `${userMessage.slice(0, 20)}...`
          : userMessage;

      const { data: currentSession } = await supabaseAdmin
        .from("chat_sessions")
        .select("title")
        .eq("id", chatSessionId)
        .eq("user_id", userId)
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
        .eq("user_id", userId);

      if (sessionUpdateError) {
        console.error("更新聊天会话失败：", sessionUpdateError.message);
      }

      return completion.points as number;
    }

    const upstreamAbortController = new AbortController();
    const timeoutId = setTimeout(() => upstreamAbortController.abort(), 60_000);
    let providerResult;

    try {
      providerResult = await openProviderStream(
        provider,
        safeMessages,
        selectedModel.model,
        upstreamAbortController.signal
      );
    } catch (error) {
      clearTimeout(timeoutId);
      await refundReservation();
      console.error("连接 AI 流式服务失败：", error);
      return NextResponse.json(
        { error: "当前 AI 模型暂时无法响应，请稍后重试或切换模型" },
        { status: 502 }
      );
    }

    if (!providerResult.response) {
      clearTimeout(timeoutId);
      await refundReservation();
      return NextResponse.json(
        { error: providerResult.error },
        { status: providerResult.status }
      );
    }

    const encoder = new TextEncoder();
    const providerReader = providerResult.response.body!.getReader();
    let clientCancelled = false;

    function encodeEvent(event: Record<string, unknown>) {
      return encoder.encode(`${JSON.stringify(event)}\n`);
    }

    const responseStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let reply = "";
        let buffer = "";
        let finalized = false;

        const enqueue = (event: Record<string, unknown>) => {
          if (!clientCancelled) {
            controller.enqueue(encodeEvent(event));
          }
        };

        enqueue({
          type: "meta",
          points: reservation.points,
          sessionId: chatSessionId,
          provider,
          model: selectedModel.model,
          modelId: selectedModel.id,
          displayName: selectedModel.displayName,
          pointCost,
          requestId,
        });

        try {
          const decoder = new TextDecoder();
          let streamFinished = false;

          while (!streamFinished) {
            const { done, value } = await providerReader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split(/\r?\n\r?\n/);
            buffer = blocks.pop() || "";

            for (const block of blocks) {
              const data = block
                .split(/\r?\n/)
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.slice(5).trim())
                .join("");

              if (!data) {
                continue;
              }

              if (data === "[DONE]") {
                streamFinished = true;
                break;
              }

              const payload = JSON.parse(data);
              const delta = payload?.choices?.[0]?.delta?.content;

              if (typeof delta === "string" && delta) {
                reply += delta;
                enqueue({ type: "delta", content: delta });
              }
            }
          }

          if (!reply.trim()) {
            throw new Error("AI 未生成有效回复");
          }

          const points = await completeAndSave(reply);
          finalized = true;
          enqueue({
            type: "done",
            points,
            sessionId: chatSessionId,
            stopped: false,
          });
        } catch (error) {
          const stopped =
            upstreamAbortController.signal.aborted || clientCancelled;

          if (reply.trim()) {
            try {
              const points = await completeAndSave(reply);
              finalized = true;
              enqueue({
                type: "done",
                points,
                sessionId: chatSessionId,
                stopped,
              });
            } catch (finalizeError) {
              console.error("保存中断的流式回复失败：", finalizeError);
            }
          } else if (!finalized) {
            await refundReservation();
          }

          if (!clientCancelled && !reply.trim()) {
            console.error("流式 AI 回复失败：", error);
            enqueue({
              type: "error",
              error: "当前出现内部技术问题，请稍后重试或联系管理员",
            });
          }
        } finally {
          clearTimeout(timeoutId);
          providerReader.releaseLock();

          if (!clientCancelled) {
            controller.close();
          }
        }
      },
      cancel() {
        clientCancelled = true;
        upstreamAbortController.abort();
      },
    });

    return new Response(responseStream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Chat API Error:", error);

    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}

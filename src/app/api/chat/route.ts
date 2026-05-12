import { NextResponse } from "next/server";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages 参数格式不正确" },
        { status: 400 }
      );
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "服务器未配置 DEEPSEEK_API_KEY" },
        { status: 500 }
      );
    }

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
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          {
            role: "system",
            content:
              "你是极智岛 AI 的智能助手。请用中文回答，表达清楚、实用、简洁，优先帮助普通用户解决实际问题。",
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

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat API Error:", error);

    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}
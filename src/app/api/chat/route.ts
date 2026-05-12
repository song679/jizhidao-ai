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

           如果用户问 AI 工具、AI模型、AI应用：
           - 先判断用户的真实用途。
           - 推荐工具时说明：适合谁、优点、缺点、是否适合小白。
           - 不要只列名字，要解释怎么用。
           - 如果某个工具有使用门槛，要明确提醒。

           如果用户问创业、赚钱、网站、自动化：
           - 要现实一点，不要鸡血。
           - 先给低成本验证方案。
           - 强调先跑通 MVP，再扩大投入。
           - 能拆步骤就拆步骤。
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

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat API Error:", error);

    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}
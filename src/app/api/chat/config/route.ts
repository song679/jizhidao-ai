import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type AiProvider = "deepseek" | "openai";

type ModelOption = {
  id: string;
  provider: AiProvider;
  model: string;
  displayName: string;
  label: string;
  pointCost: number;
};

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
      label: `ChatGPT - ${model}（${openaiPointCost} 点/次）`,
      pointCost: openaiPointCost,
    })),
    ...deepseekModels.map((model) => ({
      id: `deepseek:${model}`,
      provider: "deepseek" as const,
      model,
      displayName: "DeepSeek",
      label: `DeepSeek - ${model}（${deepseekPointCost} 点/次）`,
      pointCost: deepseekPointCost,
    })),
  ];
}

export async function GET() {
  const provider = process.env.AI_PROVIDER === "openai" ? "openai" : "deepseek";
  const modelOptions = getModelOptions();
  const defaultModel =
    provider === "openai"
      ? process.env.OPENAI_MODEL || "chat-latest"
      : process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  const selectedModel =
    modelOptions.find(
      (option) => option.provider === provider && option.model === defaultModel
    ) ||
    modelOptions.find((option) => option.provider === provider) ||
    modelOptions[0];

  return NextResponse.json({
    provider: selectedModel.provider,
    model: selectedModel.model,
    modelId: selectedModel.id,
    displayName: selectedModel.displayName,
    models: modelOptions,
  });
}

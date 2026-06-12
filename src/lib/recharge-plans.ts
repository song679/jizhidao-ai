export type RechargePlan = {
  id: string;
  name: string;
  priceCents: number;
  points: number;
  description: string;
  highlighted: boolean;
};

export const rechargePlans: RechargePlan[] = [
  {
    id: "starter",
    name: "体验包",
    priceCents: 990,
    points: 1_000,
    description: "适合轻度体验 AI 聊天、写文案和日常问答。",
    highlighted: false,
  },
  {
    id: "standard",
    name: "标准包",
    priceCents: 2_990,
    points: 5_000,
    description: "适合日常写作、办公、电商和自媒体使用。",
    highlighted: true,
  },
  {
    id: "advanced",
    name: "进阶包",
    priceCents: 9_900,
    points: 20_000,
    description: "适合高频使用、内容创作、电商运营和团队测试。",
    highlighted: false,
  },
];

export function getRechargePlan(planId: unknown) {
  return typeof planId === "string"
    ? rechargePlans.find((plan) => plan.id === planId) || null
    : null;
}

export function formatPlanPrice(priceCents: number) {
  return (priceCents / 100).toFixed(priceCents % 100 === 0 ? 0 : 2);
}

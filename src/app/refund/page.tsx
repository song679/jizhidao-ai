import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "充值与退款说明 - 极智岛 AI",
  description:
    "极智岛 AI 充值与退款说明，介绍手动充值、到账核对、异常处理及退款条件。",
};

const sections = [
  {
    title: "一、适用范围",
    content: [
      "本说明适用于极智岛 AI 测试阶段的点数充值、到账核对、异常补单和退款处理。",
      "当前平台暂未接入自动支付，充值主要由用户联系管理员、确认付款后手动增加点数。",
      "如后续接入微信、支付宝、Stripe 或其他支付渠道，平台将根据实际支付流程更新本说明。",
    ],
  },
  {
    title: "二、充值流程",
    content: [
      "用户应先登录网站，确认用于登录的邮箱，并在价格页选择套餐。",
      "用户应向管理员提供登录邮箱、套餐名称、付款凭证及必要的转账备注。",
      "管理员核对付款后，将为对应登录邮箱增加点数。充值完成后，用户可在点数明细页面查看充值数量、时间和变动后余额。",
      "用户应在付款前核对收款对象和充值信息。请勿向未经平台确认的个人或账号付款。",
    ],
  },
  {
    title: "三、到账时间与核对",
    content: [
      "手动充值通常在管理员确认付款后的合理时间内处理，具体时间可能受工作时间、网络、付款核验和系统状态影响。",
      "若付款后点数未到账，用户应提供登录邮箱、付款时间、付款金额、付款凭证和选择的套餐，联系管理员核对。",
      "用户应及时检查点数明细。因用户提供错误邮箱导致点数加到其他账号的，平台将尽力协助，但不能保证一定能够追回或调整。",
    ],
  },
  {
    title: "四、退款条件",
    content: [
      "充值点数尚未使用，且用户在付款后七日内提出申请的，平台可根据实际付款情况、支付渠道状态和法律规定审核退款。",
      "因平台原因导致重复充值、点数未到账且无法补发、充值金额或点数明显错误的，平台核实后可补发、调整或退款。",
      "因第三方支付渠道退款产生的手续费，如依法或依渠道规则应由用户承担，退款时可能扣除相应费用。",
      "法律法规规定必须退款的情形，按照法律法规执行。",
    ],
  },
  {
    title: "五、通常不予退款的情形",
    content: [
      "已正常消耗的点数通常不予退款。若账号中同时包含充值点数和赠送点数，平台可根据点数流水、时间顺序和实际使用情况核算剩余可退部分。",
      "新用户赠送、活动赠送、补偿或测试点数不对应用户实际付款，不支持提现或退款。",
      "因用户违反用户协议、实施攻击、欺诈、绕过计费、滥用接口或其他违规行为而被限制或终止服务的，已消耗点数及相关损失通常不予退还。",
      "因用户填写错误邮箱、账号共享、邮箱失窃、误操作或未核对 AI 输出造成的损失，平台将在合理范围内协助，但不当然构成退款理由。",
      "已经完成并正常提供的 AI 模型调用属于即时数字服务，对应已消耗点数不支持撤销。",
    ],
  },
  {
    title: "六、异常扣点与失败退款",
    content: [
      "平台采用原子扣点、请求去重和失败退款机制。AI 模型调用失败时，系统会尽力自动退还本次预扣点数。",
      "如服务中断导致预扣状态长时间未完成，系统会自动恢复超时预扣点数。",
      "若用户发现 AI 未返回有效结果但点数仍被扣除，可提供发生时间、使用模型、问题描述和点数明细截图联系管理员核查。",
      "经核实属于系统异常的，平台可补回相应点数；属于模型正常生成但用户对结果不满意的，通常不视为系统异常。",
    ],
  },
  {
    title: "七、退款申请方式",
    content: [
      "用户应通过价格页公布的管理员联系方式提交退款申请。",
      "申请材料通常包括：登录邮箱、充值时间、充值金额、套餐名称、付款凭证、当前点数余额、退款原因及收款信息。",
      "为防止冒用和欺诈，平台可能要求用户完成邮箱身份验证或补充交易证明。",
      "平台将在收到完整材料后的合理期限内审核。审核通过后，退款将优先原路退回；无法原路退回时，双方可协商其他合法方式。",
    ],
  },
  {
    title: "八、点数调整与退款后的处理",
    content: [
      "退款获批后，平台有权从用户账号扣除对应未使用点数，并在点数流水中记录调整。",
      "如账号剩余点数不足以扣除应退部分，平台可根据实际使用情况重新核算退款金额，或要求用户补足相关差额。",
      "涉嫌欺诈、重复退款、恶意拒付或异常交易的，平台可暂停退款并采取账号限制、安全核验或依法处理等措施。",
    ],
  },
  {
    title: "九、说明更新与联系我们",
    content: [
      "平台可根据支付方式、套餐规则、运营阶段和法律法规变化更新本说明。更新内容将在本页面公布并注明生效日期。",
      "如对充值、扣点、退款或点数流水有疑问，请通过价格页的管理员联系方式咨询。",
    ],
  },
];

export default function RefundPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <Link href="/" className="text-2xl font-bold">
            极智岛 AI
          </Link>
          <Link
            href="/pricing"
            className="rounded-full border border-cyan-400/40 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10"
          >
            会员价格
          </Link>
        </header>

        <section className="border-b border-slate-800 py-12">
          <p className="text-sm font-semibold text-cyan-300">充值与售后</p>
          <h1 className="mt-3 text-4xl font-bold md:text-5xl">
            充值与退款说明
          </h1>
          <p className="mt-5 text-sm leading-7 text-slate-400">
            发布日期：2026年6月11日　生效日期：2026年6月11日
          </p>
          <p className="mt-4 max-w-3xl leading-8 text-slate-300">
            当前平台采用管理员手动充值。付款前请确认登录邮箱和套餐，充值后请及时核对点数明细。
          </p>
        </section>

        <article className="divide-y divide-slate-800">
          {sections.map((section) => (
            <section key={section.title} className="py-9">
              <h2 className="text-xl font-bold">{section.title}</h2>
              <div className="mt-5 space-y-4 text-sm leading-7 text-slate-300">
                {section.content.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </article>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 py-8 text-sm text-slate-400">
          <span>极智岛 AI</span>
          <div className="flex flex-wrap gap-5">
            <Link href="/terms" className="hover:text-white">
              用户协议
            </Link>
            <Link href="/privacy" className="hover:text-white">
              隐私政策
            </Link>
            <Link href="/pricing" className="hover:text-white">
              会员价格
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

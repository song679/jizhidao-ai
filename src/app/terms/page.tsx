import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "用户协议 - 极智岛 AI",
  description: "极智岛 AI 用户协议，说明账号、AI 服务、点数、内容规范和责任边界。",
};

const sections = [
  {
    title: "一、协议的接受与适用",
    content: [
      "欢迎使用极智岛 AI。本协议是你与极智岛 AI 平台运营方（以下简称“平台”）之间关于访问和使用本平台服务的约定。",
      "当你注册、登录、访问或使用本平台，即表示你已阅读、理解并同意本协议。若你不同意本协议的任何内容，请停止使用本平台。",
      "本平台目前处于测试和持续完善阶段，部分功能、模型、点数规则和服务方式可能调整。涉及用户权益的重要变更，平台将通过页面提示、公告或其他合理方式通知。",
    ],
  },
  {
    title: "二、账号注册与安全",
    content: [
      "本平台目前使用邮箱登录。你应提供本人合法使用、能够正常接收邮件的邮箱，并妥善保管邮箱账号及登录链接。",
      "账号仅限你本人使用。因邮箱泄露、转让账号、共享登录链接或其他用户自身原因造成的损失，由用户自行承担。",
      "如发现账号被盗用、异常登录或未经授权的操作，请立即停止使用并联系管理员处理。",
      "平台有权对涉嫌欺诈、滥用、攻击、批量注册、绕过计费或违反法律法规的账号采取限制、暂停或终止服务等措施。",
    ],
  },
  {
    title: "三、AI 服务说明",
    content: [
      "本平台聚合或接入第三方人工智能模型，为用户提供聊天、写作、办公、电商文案、短视频脚本等辅助功能。",
      "AI 生成内容由模型基于概率生成，可能存在错误、遗漏、过时、虚构、偏差或不适当内容。平台不保证生成结果真实、准确、完整或适合特定用途。",
      "用户应对 AI 输出进行独立判断和必要核验，不应将其直接作为医疗、法律、金融、投资、安全生产等高风险事项的唯一依据。",
      "第三方模型可能因维护、额度、网络、政策或服务调整而暂时不可用。平台可根据实际情况增加、替换、暂停或下线模型。",
    ],
  },
  {
    title: "四、用户行为规范",
    content: [
      "用户不得利用本平台制作、复制、发布、传播法律法规禁止的信息，不得危害国家安全、公共安全或他人合法权益。",
      "用户不得生成或传播诈骗、暴力、淫秽、侵权、诽谤、仇恨、恶意代码、网络攻击、违法交易等内容。",
      "用户不得通过自动化程序、并发攻击、接口探测、逆向工程、绕过限流、伪造请求、重复提交或其他方式干扰平台运行、套取点数或规避计费。",
      "用户不得输入无权处理的个人信息、商业秘密、账号密码、支付凭证或其他敏感信息。因用户主动输入相关内容造成的风险，由用户自行承担。",
      "用户对其输入内容、使用方式及生成内容的后续发布、传播和使用承担责任。",
    ],
  },
  {
    title: "五、点数与充值",
    content: [
      "本平台采用点数计费。不同 AI 模型可能消耗不同点数，具体以聊天页面显示的实时规则为准。",
      "新用户赠送点数属于测试或推广权益，不可提现、转让或兑换现金。平台可根据运营情况调整赠送规则。",
      "当前测试阶段主要采用管理员手动充值。用户应核对登录邮箱、套餐、金额和点数，并保留付款凭证。",
      "点数到账后，用户可在点数明细页面查看记录。若发现充值或扣点异常，应及时联系管理员并提供相关凭证。",
      "除法律法规另有规定或平台明确同意外，已经正常消耗的点数不予退还。具体退款条件以后续发布的充值与退款说明为准。",
    ],
  },
  {
    title: "六、知识产权",
    content: [
      "平台页面、品牌标识、程序代码、界面设计、运营内容及相关资料的知识产权归平台或相关权利人所有。",
      "用户应确保输入内容来源合法，并已取得必要授权。因输入内容侵犯第三方知识产权、隐私权或其他权利产生的责任，由用户承担。",
      "在法律法规及第三方模型规则允许的范围内，用户可以使用其生成内容，但应自行核验是否涉及第三方权利，并承担后续使用风险。",
      "未经授权，用户不得复制、出售、出租、转授权平台本身的程序、页面、标识或服务能力。",
    ],
  },
  {
    title: "七、服务变更、中断与终止",
    content: [
      "平台可能因系统维护、升级、网络故障、第三方服务异常、不可抗力或监管要求暂停部分或全部服务。",
      "平台将尽合理努力保障服务稳定，但不承诺服务永久不中断或完全无错误。",
      "用户严重违反本协议、法律法规或损害平台及他人权益时，平台有权限制功能、冻结账号、终止服务并保留依法追究责任的权利。",
    ],
  },
  {
    title: "八、责任限制",
    content: [
      "对于因用户错误操作、未核验 AI 内容、违反本协议、第三方服务异常、网络故障或不可抗力造成的损失，平台将在法律允许范围内不承担责任。",
      "平台不对用户利用 AI 输出作出的商业、投资、医疗、法律或其他决策结果作出保证。",
      "如平台依法需要承担责任，责任范围和金额应以法律规定、实际直接损失及用户就相关服务实际支付的费用为限，但法律另有强制性规定的除外。",
    ],
  },
  {
    title: "九、个人信息与隐私",
    content: [
      "平台将按照合法、正当、必要和诚信原则处理用户信息，并采取合理安全措施保护用户数据。",
      "关于邮箱、聊天内容、点数记录、日志等信息的处理方式，将在《隐私政策》中进一步说明。",
      "用户应避免在对话中输入敏感个人信息。使用第三方 AI 模型时，必要的对话内容可能被发送至对应模型服务商以生成回复。",
    ],
  },
  {
    title: "十、协议更新与争议处理",
    content: [
      "平台可根据业务发展、技术变化和法律法规要求更新本协议。更新后的协议将在本页面公布，并注明生效日期。",
      "本协议的订立、执行和解释适用中华人民共和国法律。",
      "因本协议或平台服务产生争议，双方应先友好协商；协商不成的，可依法向有管辖权的人民法院提起诉讼。",
    ],
  },
  {
    title: "十一、联系我们",
    content: [
      "如对本协议、账号、点数或平台服务有疑问，可通过价格页公布的管理员联系方式与平台联系。",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <Link href="/" className="text-2xl font-bold">
            极智岛 AI
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-cyan-400/40 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10"
          >
            登录 / 注册
          </Link>
        </header>

        <section className="border-b border-slate-800 py-12">
          <p className="text-sm font-semibold text-cyan-300">法律与规则</p>
          <h1 className="mt-3 text-4xl font-bold md:text-5xl">用户协议</h1>
          <p className="mt-5 text-sm leading-7 text-slate-400">
            发布日期：2026年6月11日　生效日期：2026年6月11日
          </p>
          <p className="mt-4 max-w-3xl leading-8 text-slate-300">
            请在使用极智岛 AI 前认真阅读本协议，特别是关于 AI
            内容准确性、用户行为、点数计费和责任限制的条款。
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
          <div className="flex gap-5">
            <Link href="/" className="hover:text-white">
              返回首页
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

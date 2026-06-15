import { getSiteUrl } from "@/lib/site-url";

type OrderNotification = {
  orderNo: string;
  email: string;
  planName: string;
  amountCents: number;
  points: number;
};

type EmailMessage = {
  to: string | string[];
  subject: string;
  text: string;
  idempotencyKey: string;
};

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function formatAmount(amountCents: number) {
  return `¥${(amountCents / 100).toFixed(2)}`;
}

async function sendEmail(message: EmailMessage) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.NOTIFICATION_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    return { sent: false, reason: "not_configured" } as const;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.error("Order notification email failed", {
        status: response.status,
      });
      return { sent: false, reason: "provider_error" } as const;
    }

    return { sent: true } as const;
  } catch (error) {
    console.error("Order notification email request failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return { sent: false, reason: "request_error" } as const;
  }
}

export async function notifyOrderCreated(order: OrderNotification) {
  const adminEmails = getAdminEmails();
  if (adminEmails.length === 0) return;

  const adminOrdersUrl = `${getSiteUrl()}/admin/orders`;

  await sendEmail({
    to: adminEmails,
    subject: `【极智岛 AI】新充值订单 ${order.orderNo}`,
    idempotencyKey: `order-created-${order.orderNo}`,
    text: [
      "收到一笔新的充值申请。",
      "",
      `订单编号：${order.orderNo}`,
      `用户邮箱：${order.email}`,
      `套餐：${order.planName}`,
      `金额：${formatAmount(order.amountCents)}`,
      `点数：${order.points.toLocaleString("zh-CN")} 点`,
      "",
      `请登录管理后台核对收款：${adminOrdersUrl}`,
      "请勿仅凭邮件确认到账，必须核对真实收款记录。",
    ].join("\n"),
  });
}

export async function notifyOrderPaid(order: OrderNotification) {
  const ordersUrl = `${getSiteUrl()}/orders`;

  await sendEmail({
    to: order.email,
    subject: `【极智岛 AI】充值已到账 ${order.orderNo}`,
    idempotencyKey: `order-paid-${order.orderNo}`,
    text: [
      "你的充值订单已经确认到账。",
      "",
      `订单编号：${order.orderNo}`,
      `套餐：${order.planName}`,
      `金额：${formatAmount(order.amountCents)}`,
      `到账点数：${order.points.toLocaleString("zh-CN")} 点`,
      "",
      `查看订单与点数：${ordersUrl}`,
      "如非本人操作，请及时联系管理员。",
    ].join("\n"),
  });
}

export async function notifyOrderCancelled(
  order: OrderNotification,
  reason: string
) {
  const ordersUrl = `${getSiteUrl()}/orders`;

  await sendEmail({
    to: order.email,
    subject: `【极智岛 AI】充值订单已取消 ${order.orderNo}`,
    idempotencyKey: `order-cancelled-${order.orderNo}`,
    text: [
      "你的充值订单已被管理员取消。",
      "",
      `订单编号：${order.orderNo}`,
      `套餐：${order.planName}`,
      `金额：${formatAmount(order.amountCents)}`,
      `原因：${reason}`,
      "",
      `查看订单：${ordersUrl}`,
      "如有疑问，请通过网站帮助与支持页面联系管理员。",
    ].join("\n"),
  });
}

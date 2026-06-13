import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";
import { parsePointDescription } from "@/lib/point-description";

const PAGE_SIZE = 50;
const EXPORT_LIMIT = 10_000;
const ALLOWED_TYPES = new Set([
  "chat",
  "recharge",
  "refund",
  "gift",
  "deduction",
]);

function normalizeEmail(value: string | null) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[%_,]/g, "")
    .slice(0, 100);
}

function normalizeType(value: string | null) {
  return value && ALLOWED_TYPES.has(value) ? value : "";
}

function chinaDateBoundary(value: string | null, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00+08:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (endOfDay) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return date.toISOString();
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  try {
    const adminContext = await authorizeAdmin(request);

    if (adminContext.error) {
      return adminContext.error;
    }

    const requestUrl = new URL(request.url);
    const email = normalizeEmail(requestUrl.searchParams.get("email"));
    const type = normalizeType(requestUrl.searchParams.get("type"));
    const fromDate = chinaDateBoundary(requestUrl.searchParams.get("from"));
    const toDate = chinaDateBoundary(
      requestUrl.searchParams.get("to"),
      true
    );
    const exportCsv = requestUrl.searchParams.get("format") === "csv";
    const page = Math.max(
      1,
      Number.parseInt(requestUrl.searchParams.get("page") || "1", 10) || 1
    );
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    if (fromDate && toDate && fromDate >= toDate) {
      return NextResponse.json(
        { error: "开始日期不能晚于结束日期" },
        { status: 400 }
      );
    }

    let query = adminContext.supabaseAdmin
      .from("point_transactions")
      .select(
        "id, email, change_amount, balance_after, type, description, created_at",
        exportCsv ? undefined : { count: "exact" }
      );

    if (email) {
      query = query.ilike("email", `%${email}%`);
    }

    if (type) {
      query = query.eq("type", type);
    }

    if (fromDate) {
      query = query.gte("created_at", fromDate);
    }

    if (toDate) {
      query = query.lt("created_at", toDate);
    }

    const result = exportCsv
      ? await query.order("created_at", { ascending: false }).limit(EXPORT_LIMIT)
      : await query.order("created_at", { ascending: false }).range(from, to);

    if (result.error) {
      console.error("查询点数流水失败：", result.error.message);
      return NextResponse.json(
        { error: "查询点数流水失败" },
        { status: 500 }
      );
    }

    const transactions = result.data || [];

    if (exportCsv) {
      const headers = [
        "流水ID",
        "用户邮箱",
        "类型",
        "变动点数",
        "变动后余额",
        "操作管理员",
        "说明",
        "创建时间",
      ];
      const rows = transactions.map((transaction) => {
        const parsedDescription = parsePointDescription(
          transaction.description
        );

        return [
          transaction.id,
          transaction.email,
          transaction.type,
          transaction.change_amount,
          transaction.balance_after,
          parsedDescription.adminEmail || "",
          parsedDescription.note,
          transaction.created_at,
        ]
          .map(escapeCsv)
          .join(",");
      });
      const csv = `\uFEFF${headers.map(escapeCsv).join(",")}\r\n${rows.join(
        "\r\n"
      )}`;
      const date = new Date().toISOString().slice(0, 10);

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="point-transactions-${date}.csv"`,
          "Cache-Control": "private, no-store, max-age=0",
        },
      });
    }

    return NextResponse.json({
      authorized: true,
      adminEmail: adminContext.adminEmail,
      transactions,
      total: result.count || 0,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    console.error("Admin Transactions API Error:", error);
    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}

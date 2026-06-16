import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const allowedStatuses = new Set([
  "received",
  "processed",
  "ignored",
  "failed",
]);

type PaymentEventRow = {
  id: string;
  provider: string;
  event_id: string;
  event_type: string | null;
  order_no: string | null;
  signature_valid: boolean;
  processing_status: string;
  payload_digest: string | null;
  error_code: string | null;
  received_at: string;
  processed_at: string | null;
};

function sanitizeSearch(value: string | null) {
  return (value || "")
    .trim()
    .slice(0, 100)
    .replace(/[^\p{L}\p{N}@._:+-]/gu, "");
}

function applyFilters<TQuery extends { eq: (...args: string[]) => TQuery; or: (value: string) => TQuery }>(
  query: TQuery,
  status: string,
  search: string
) {
  let nextQuery = query;

  if (allowedStatuses.has(status)) {
    nextQuery = nextQuery.eq("processing_status", status);
  }

  if (search) {
    nextQuery = nextQuery.or(
      `event_id.ilike.%${search}%,order_no.ilike.%${search}%,provider.ilike.%${search}%`
    );
  }

  return nextQuery;
}

function escapeCsvCell(value: unknown) {
  const text =
    value === null || typeof value === "undefined" ? "" : String(value);
  const injectionSafeText = /^[=+\-@\t\r]/.test(text) ? `\t${text}` : text;

  return `"${injectionSafeText.replace(/"/g, '""')}"`;
}

function buildCsv(events: PaymentEventRow[]) {
  const headers = [
    "provider",
    "event_id",
    "event_type",
    "order_no",
    "signature_valid",
    "processing_status",
    "error_code",
    "payload_digest",
    "received_at",
    "processed_at",
  ];
  const rows = events.map((item) => [
    item.provider,
    item.event_id,
    item.event_type,
    item.order_no,
    item.signature_valid ? "true" : "false",
    item.processing_status,
    item.error_code,
    item.payload_digest,
    item.received_at,
    item.processed_at,
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");
}

export async function GET(request: Request) {
  const context = await authorizeAdmin(request);

  if (context.error) {
    return context.error;
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";
  const format = searchParams.get("format") || "json";
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") || "1", 10) || 1
  );
  const pageSize = Math.min(
    50,
    Math.max(
      10,
      Number.parseInt(searchParams.get("pageSize") || "20", 10) || 20
    )
  );
  const search = sanitizeSearch(searchParams.get("search"));
  const rangeStart = (page - 1) * pageSize;
  const rangeEnd = rangeStart + pageSize - 1;

  if (format === "csv") {
    let exportQuery = context.supabaseAdmin
      .from("payment_webhook_events")
      .select(
        "id, provider, event_id, event_type, order_no, signature_valid, processing_status, payload_digest, error_code, received_at, processed_at"
      )
      .order("received_at", { ascending: false })
      .limit(5000);

    exportQuery = applyFilters(exportQuery, status, search);

    const { data: events, error } = await exportQuery;

    if (error?.code === "42P01" || error?.code === "PGRST205") {
      return NextResponse.json(
        { error: "支付回调数据库尚未初始化" },
        { status: 503 }
      );
    }

    if (error) {
      return NextResponse.json(
        { error: "导出支付回调事件失败，请稍后重试" },
        { status: 500 }
      );
    }

    const csv = buildCsv((events || []) as PaymentEventRow[]);
    const filename = `payment-events-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  let query = context.supabaseAdmin
    .from("payment_webhook_events")
    .select(
      "id, provider, event_id, event_type, order_no, signature_valid, processing_status, payload_digest, error_code, received_at, processed_at",
      { count: "exact" }
    )
    .order("received_at", { ascending: false })
    .range(rangeStart, rangeEnd);

  query = applyFilters(query, status, search);

  const [eventsResult, statusResults] = await Promise.all([
    query,
    Promise.all(
      Array.from(allowedStatuses).map((item) =>
        context.supabaseAdmin
          .from("payment_webhook_events")
          .select("id", { count: "exact", head: true })
          .eq("processing_status", item)
      )
    ),
  ]);
  const { data: events, error, count } = eventsResult;

  if (error?.code === "42P01" || error?.code === "PGRST205") {
    return NextResponse.json({
      ready: false,
      events: [],
      total: 0,
      page,
      pageSize,
      summary: {
        received: 0,
        processed: 0,
        ignored: 0,
        failed: 0,
      },
    });
  }

  if (error) {
    return NextResponse.json(
      { error: "加载支付回调事件失败，请稍后重试" },
      { status: 500 }
    );
  }

  const summary = Object.fromEntries(
    Array.from(allowedStatuses).map((item, index) => [
      item,
      statusResults[index]?.count || 0,
    ])
  );

  return NextResponse.json({
    ready: true,
    events: events || [],
    total: count || 0,
    page,
    pageSize,
    summary,
  });
}

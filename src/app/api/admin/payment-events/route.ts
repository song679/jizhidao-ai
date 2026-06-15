import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";

const allowedStatuses = new Set([
  "received",
  "processed",
  "ignored",
  "failed",
]);

export async function GET(request: Request) {
  const context = await authorizeAdmin(request);

  if (context.error) {
    return context.error;
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";
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
  const search = (searchParams.get("search") || "")
    .trim()
    .slice(0, 100)
    .replace(/[^\p{L}\p{N}@._:+-]/gu, "");
  const rangeStart = (page - 1) * pageSize;
  const rangeEnd = rangeStart + pageSize - 1;

  let query = context.supabaseAdmin
    .from("payment_webhook_events")
    .select(
      "id, provider, event_id, event_type, order_no, signature_valid, processing_status, payload_digest, error_code, received_at, processed_at",
      { count: "exact" }
    )
    .order("received_at", { ascending: false })
    .range(rangeStart, rangeEnd);

  if (allowedStatuses.has(status)) {
    query = query.eq("processing_status", status);
  }

  if (search) {
    query = query.or(
      `event_id.ilike.%${search}%,order_no.ilike.%${search}%,provider.ilike.%${search}%`
    );
  }

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

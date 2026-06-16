import { NextResponse } from "next/server";
import { getPaymentRuntimeStatus } from "@/lib/payments/status";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getPaymentRuntimeStatus(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

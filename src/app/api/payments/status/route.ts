import { NextResponse } from "next/server";
import {
  getPaymentRuntimeStatus,
  toPublicPaymentRuntimeStatus,
} from "@/lib/payments/status";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(toPublicPaymentRuntimeStatus(getPaymentRuntimeStatus()), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

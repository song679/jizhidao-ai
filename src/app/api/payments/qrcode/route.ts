import { NextResponse } from "next/server";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text") || "";

  if (!text || text.length > 2048) {
    return NextResponse.json({ error: "Invalid QR code text" }, { status: 400 });
  }

  const svg = await QRCode.toString(text, {
    type: "svg",
    margin: 2,
    width: 320,
    errorCorrectionLevel: "M",
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

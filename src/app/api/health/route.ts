import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    return NextResponse.json(
      {
        status: "degraded",
        checkedAt,
        services: {
          app: "ok",
          database: "configuration_missing",
        },
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const startedAt = Date.now();

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { error } = await supabaseAdmin
      .from("user_points")
      .select("id", { count: "exact", head: true });

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        status: "healthy",
        checkedAt,
        responseTimeMs: Date.now() - startedAt,
        services: {
          app: "ok",
          database: "ok",
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Health Check Error:", error);

    return NextResponse.json(
      {
        status: "degraded",
        checkedAt,
        responseTimeMs: Date.now() - startedAt,
        services: {
          app: "ok",
          database: "unavailable",
        },
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

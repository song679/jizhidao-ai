import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function normalizeSearch(value: string | null) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[%_,]/g, "")
    .slice(0, 100);
}

export async function GET(request: Request) {
  try {
    const adminContext = await authorizeAdmin(request);

    if (adminContext.error) {
      return adminContext.error;
    }

    const requestUrl = new URL(request.url);
    const targetEmail = requestUrl.searchParams
      .get("email")
      ?.trim()
      .toLowerCase();

    if (targetEmail) {
      if (!targetEmail.includes("@")) {
        return NextResponse.json(
          { error: "请输入正确的用户邮箱" },
          { status: 400 }
        );
      }

      const { data: user, error: userError } =
        await adminContext.supabaseAdmin
          .from("user_points")
          .select("id, email, points, updated_at")
          .eq("email", targetEmail)
          .maybeSingle();

      if (userError) {
        console.error("查询用户信息失败：", userError.message);
        return NextResponse.json(
          { error: "查询用户信息失败" },
          { status: 500 }
        );
      }

      if (!user) {
        return NextResponse.json(
          { error: "没有找到该用户的点数账户" },
          { status: 404 }
        );
      }

      const { data: transactions, error: transactionsError } =
        await adminContext.supabaseAdmin
          .from("point_transactions")
          .select(
            "id, change_amount, balance_after, type, description, created_at"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30);

      if (transactionsError) {
        console.error("查询用户点数流水失败：", transactionsError.message);
        return NextResponse.json(
          { error: "查询用户点数流水失败" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        user,
        transactions: transactions || [],
      });
    }

    const page = Math.max(
      1,
      Number.parseInt(requestUrl.searchParams.get("page") || "1", 10) || 1
    );
    const search = normalizeSearch(requestUrl.searchParams.get("search"));
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = adminContext.supabaseAdmin
      .from("user_points")
      .select("id, email, points, updated_at", { count: "exact" });

    if (search) {
      query = query.ilike("email", `%${search}%`);
    }

    const {
      data: users,
      count,
      error: usersError,
    } = await query
      .order("updated_at", { ascending: false })
      .range(from, to);

    if (usersError) {
      console.error("查询用户列表失败：", usersError.message);
      return NextResponse.json(
        { error: "查询用户列表失败" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      authorized: true,
      adminEmail: adminContext.adminEmail,
      users: users || [],
      total: count || 0,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    console.error("Admin Users API Error:", error);

    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function authorizeAdmin(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseSecretKey) {
    return {
      error: NextResponse.json(
        { error: "服务器环境变量配置不完整" },
        { status: 500 }
      ),
    };
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { error: "请先登录管理员账号" },
        { status: 401 }
      ),
    };
  }

  const adminEmails = getAdminEmails();

  if (adminEmails.length === 0) {
    return {
      error: NextResponse.json(
        { error: "服务器未配置管理员账号" },
        { status: 500 }
      ),
    };
  }

  const accessToken = authorization.replace("Bearer ", "");
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
  const {
    data: { user: adminUser },
    error: adminUserError,
  } = await supabaseAuth.auth.getUser(accessToken);

  if (adminUserError || !adminUser?.email) {
    return {
      error: NextResponse.json(
        { error: "管理员登录状态无效，请重新登录" },
        { status: 401 }
      ),
    };
  }

  if (!adminEmails.includes(adminUser.email.toLowerCase())) {
    return {
      error: NextResponse.json(
        { error: "当前账号没有管理员权限" },
        { status: 403 }
      ),
    };
  }

  return {
    error: null,
    adminEmail: adminUser.email,
    supabaseAdmin: createClient(supabaseUrl, supabaseSecretKey),
  };
}

export async function GET(request: Request) {
  try {
    const adminContext = await authorizeAdmin(request);

    if (adminContext.error) {
      return adminContext.error;
    }

    const requestUrl = new URL(request.url);
    const targetEmail = requestUrl.searchParams.get("email")?.trim().toLowerCase();

    if (!targetEmail) {
      const { data: recentRecharges, error: rechargeQueryError } =
        await adminContext.supabaseAdmin
          .from("point_transactions")
          .select(
            "id, email, change_amount, balance_after, description, created_at"
          )
          .eq("type", "recharge")
          .order("created_at", { ascending: false })
          .limit(20);

      if (rechargeQueryError) {
        return NextResponse.json(
          {
            error: "查询最近充值记录失败",
            detail: rechargeQueryError.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        authorized: true,
        adminEmail: adminContext.adminEmail,
        recentRecharges: recentRecharges || [],
      });
    }

    if (!targetEmail.includes("@")) {
      return NextResponse.json(
        { error: "请输入正确的用户邮箱" },
        { status: 400 }
      );
    }

    const { data: targetPoints, error: targetPointsError } =
      await adminContext.supabaseAdmin
        .from("user_points")
        .select("id, email, points")
        .eq("email", targetEmail)
        .maybeSingle();

    if (targetPointsError) {
      return NextResponse.json(
        { error: "查询用户账号失败", detail: targetPointsError.message },
        { status: 500 }
      );
    }

    if (targetPoints) {
      return NextResponse.json({
        found: true,
        email: targetEmail,
        points: targetPoints.points ?? 0,
        initialized: true,
      });
    }

    const { data: authUsers, error: authUsersError } =
      await adminContext.supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (authUsersError) {
      return NextResponse.json(
        { error: "查询登录用户失败", detail: authUsersError.message },
        { status: 500 }
      );
    }

    const targetUser = authUsers.users.find(
      (user) => user.email?.toLowerCase() === targetEmail
    );

    if (!targetUser) {
      return NextResponse.json(
        { error: "没有找到使用该邮箱注册的用户" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      found: true,
      email: targetEmail,
      points: 1000,
      initialized: false,
    });
  } catch (error) {
    console.error("Admin Account Lookup API Error:", error);

    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const adminContext = await authorizeAdmin(request);

    if (adminContext.error) {
      return adminContext.error;
    }

    const body = await request.json();
    const targetEmail =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const amount = Number(body.amount);
    const note =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 200)
        : "管理员手动充值";

    if (!targetEmail || !targetEmail.includes("@")) {
      return NextResponse.json(
        { error: "请输入正确的用户邮箱" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) {
      return NextResponse.json(
        { error: "充值点数必须是 1 至 1,000,000 的整数" },
        { status: 400 }
      );
    }

    const { data: existingTargetPoints, error: targetPointsError } =
      await adminContext.supabaseAdmin
        .from("user_points")
        .select("id, email, points")
        .eq("email", targetEmail)
        .maybeSingle();
    let targetPoints = existingTargetPoints;

    if (targetPointsError) {
      return NextResponse.json(
        { error: "查询用户账号失败", detail: targetPointsError.message },
        { status: 500 }
      );
    }

    if (!targetPoints) {
      const { data: authUsers, error: authUsersError } =
        await adminContext.supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

      if (authUsersError) {
        return NextResponse.json(
          { error: "查询登录用户失败", detail: authUsersError.message },
          { status: 500 }
        );
      }

      const targetUser = authUsers.users.find(
        (user) => user.email?.toLowerCase() === targetEmail
      );

      if (!targetUser) {
        return NextResponse.json(
          { error: "没有找到使用该邮箱注册的用户" },
          { status: 404 }
        );
      }

      const { data: createdPoints, error: createPointsError } =
        await adminContext.supabaseAdmin
          .from("user_points")
          .insert({
            id: targetUser.id,
            email: targetEmail,
            points: 1000,
          })
          .select("id, email, points")
          .single();

      if (createPointsError || !createdPoints) {
        return NextResponse.json(
          {
            error: "初始化用户点数失败",
            detail: createPointsError?.message,
          },
          { status: 500 }
        );
      }

      const { error: giftTransactionError } = await adminContext.supabaseAdmin
        .from("point_transactions")
        .insert({
          user_id: targetUser.id,
          email: targetEmail,
          change_amount: 1000,
          balance_after: 1000,
          type: "gift",
          description: "新用户注册赠送 1000 点",
        });

      if (giftTransactionError) {
        console.error(
          "写入新用户赠送流水失败：",
          giftTransactionError.message
        );
      }

      targetPoints = createdPoints;
    }

    const previousPoints = targetPoints.points ?? 0;
    const nextPoints = previousPoints + amount;
    const { error: updatePointsError } = await adminContext.supabaseAdmin
      .from("user_points")
      .update({
        points: nextPoints,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetPoints.id);

    if (updatePointsError) {
      return NextResponse.json(
        { error: "更新用户点数失败", detail: updatePointsError.message },
        { status: 500 }
      );
    }

    const { error: transactionError } = await adminContext.supabaseAdmin
      .from("point_transactions")
      .insert({
        user_id: targetPoints.id,
        email: targetEmail,
        change_amount: amount,
        balance_after: nextPoints,
        type: "recharge",
        description: note,
      });

    if (transactionError) {
      console.error("写入充值流水失败：", transactionError.message);
      return NextResponse.json(
        { error: "点数已更新，但充值流水写入失败，请联系技术人员" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      email: targetEmail,
      addedPoints: amount,
      previousPoints,
      points: nextPoints,
    });
  } catch (error) {
    console.error("Admin Recharge API Error:", error);

    return NextResponse.json(
      { error: "服务器内部错误，请稍后再试" },
      { status: 500 }
    );
  }
}

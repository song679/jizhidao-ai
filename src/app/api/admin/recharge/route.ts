import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";
import { createAdminPointDescription } from "@/lib/point-description";

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
            "id, email, change_amount, balance_after, type, description, created_at"
          )
          .in("type", ["recharge", "deduction"])
          .order("created_at", { ascending: false })
          .limit(20);

      if (rechargeQueryError) {
        console.error("查询最近充值记录失败：", rechargeQueryError.message);
        return NextResponse.json(
          { error: "查询最近充值记录失败" },
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
      console.error("查询用户账号失败：", targetPointsError.message);
      return NextResponse.json(
        { error: "查询用户账号失败" },
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
      console.error("查询登录用户失败：", authUsersError.message);
      return NextResponse.json(
        { error: "查询登录用户失败" },
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
    const operation = body.operation === "deduct" ? "deduct" : "add";
    const note =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 200)
        : operation === "deduct"
          ? "管理员手动扣减"
          : "管理员手动充值";

    if (!targetEmail || !targetEmail.includes("@")) {
      return NextResponse.json(
        { error: "请输入正确的用户邮箱" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) {
      return NextResponse.json(
        { error: "调整点数必须是 1 至 1,000,000 的整数" },
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
      console.error("查询用户账号失败：", targetPointsError.message);
      return NextResponse.json(
        { error: "查询用户账号失败" },
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
        console.error("查询登录用户失败：", authUsersError.message);
        return NextResponse.json(
          { error: "查询登录用户失败" },
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
        console.error(
          "初始化用户点数失败：",
          createPointsError?.message || "未返回新建点数账户"
        );
        return NextResponse.json(
          { error: "初始化用户点数失败" },
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
    const changeAmount = operation === "deduct" ? -amount : amount;
    const nextPoints = previousPoints + changeAmount;
    const auditDescription = createAdminPointDescription(
      adminContext.adminEmail,
      note
    );

    if (nextPoints < 0) {
      return NextResponse.json(
        {
          error: `用户当前余额只有 ${previousPoints} 点，无法扣减 ${amount} 点`,
        },
        { status: 400 }
      );
    }

    const {
      data: updatedPoints,
      error: updatePointsError,
    } = await adminContext.supabaseAdmin
      .from("user_points")
      .update({
        points: nextPoints,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetPoints.id)
      .eq("points", previousPoints)
      .select("id, points")
      .maybeSingle();

    if (updatePointsError) {
      console.error("更新用户点数失败：", updatePointsError.message);
      return NextResponse.json(
        { error: "更新用户点数失败" },
        { status: 500 }
      );
    }

    if (!updatedPoints) {
      return NextResponse.json(
        { error: "用户余额刚刚发生变化，请重新查询后再操作" },
        { status: 409 }
      );
    }

    const { error: transactionError } = await adminContext.supabaseAdmin
      .from("point_transactions")
      .insert({
        user_id: targetPoints.id,
        email: targetEmail,
        change_amount: changeAmount,
        balance_after: nextPoints,
        type: operation === "deduct" ? "deduction" : "recharge",
        description: auditDescription,
      });

    if (transactionError) {
      console.error("写入充值流水失败：", transactionError.message);

      const {
        data: rolledBackPoints,
        error: rollbackError,
      } = await adminContext.supabaseAdmin
        .from("user_points")
        .update({
          points: previousPoints,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetPoints.id)
        .eq("points", nextPoints)
        .select("id")
        .maybeSingle();

      if (rollbackError || !rolledBackPoints) {
        console.error(
          "回滚用户点数失败：",
          rollbackError?.message || "余额已再次发生变化"
        );
      }

      return NextResponse.json(
        {
          error: rollbackError || !rolledBackPoints
            ? "流水写入失败且余额回滚异常，请立即联系技术人员"
            : "流水写入失败，本次余额变动已撤销",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      email: targetEmail,
      operation,
      changeAmount,
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

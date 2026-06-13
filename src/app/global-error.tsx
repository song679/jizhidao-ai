"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";

function createErrorCode(prefix: string, error: Error) {
  const source = `${error.name}:${error.message}`;
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return `${prefix}-${hash.toString(36).toUpperCase().padStart(6, "0")}`;
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const errorCode = useMemo(
    () => error.digest || createErrorCode("ROOT", error),
    [error]
  );

  useEffect(() => {
    console.error("应用根级运行异常：", {
      code: errorCode,
      name: error.name,
      message: error.message,
      digest: error.digest,
    });
  }, [error, errorCode]);

  return (
    <html lang="zh-CN">
      <body style={{ margin: 0 }}>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            boxSizing: "border-box",
            background: "#020617",
            color: "#ffffff",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          <section
            aria-live="assertive"
            style={{
              width: "100%",
              maxWidth: "560px",
              padding: "40px",
              boxSizing: "border-box",
              border: "1px solid rgba(251, 113, 133, 0.3)",
              borderRadius: "24px",
              background: "rgba(15, 23, 42, 0.92)",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, color: "#fda4af", fontWeight: 700 }}>
              网站暂时无法正常显示
            </p>
            <h1 style={{ margin: "16px 0 0", fontSize: "30px" }}>
              当前出现内部技术问题
            </h1>
            <p
              style={{
                margin: "16px 0 0",
                color: "#94a3b8",
                lineHeight: 1.8,
              }}
            >
              系统已经阻止异常继续扩散。请尝试恢复页面；如果仍然失败，可以返回首页或联系管理员。
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "12px",
                marginTop: "28px",
              }}
            >
              <button
                type="button"
                onClick={reset}
                style={{
                  border: 0,
                  borderRadius: "12px",
                  padding: "13px 18px",
                  background: "#22d3ee",
                  color: "#020617",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                尝试恢复
              </button>
              <Link
                href="/"
                style={{
                  border: "1px solid #334155",
                  borderRadius: "12px",
                  padding: "12px 18px",
                  color: "#ffffff",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                返回首页
              </Link>
              <Link
                href={`/support?error=${encodeURIComponent(errorCode)}`}
                style={{
                  border: "1px solid #334155",
                  borderRadius: "12px",
                  padding: "12px 18px",
                  color: "#67e8f9",
                  textDecoration: "none",
                  fontWeight: 700,
                }}
              >
                联系管理员
              </Link>
            </div>
            <p
              style={{
                margin: "24px 0 0",
                color: "#64748b",
                fontSize: "12px",
              }}
            >
              故障编号：{errorCode}
            </p>
          </section>
        </main>
      </body>
    </html>
  );
}

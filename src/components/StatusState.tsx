import type { ReactNode } from "react";
import { Button, Tag } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";

import { routePaths } from "../router/routeAccess";

type StatusVariant = "empty" | "forbidden" | "notfound";

interface StatusStateProps {
  variant?: StatusVariant;
  eyebrow?: string;
  icon?: ReactNode;
  title: string;
  description: string;
  primaryLabel?: string;
  primaryTo?: string;
  secondaryLabel?: string;
  secondaryTo?: string;
  backLabel?: string;
  compact?: boolean;
}

const variantStyles: Record<StatusVariant, { code: string; accent: string; glow: string }> = {
  empty: {
    code: "00",
    accent: "from-[#eef6ff] to-[#f9fbff]",
    glow: "bg-[radial-gradient(circle_at_top,rgba(82,146,255,0.16),transparent_52%)]",
  },
  forbidden: {
    code: "403",
    accent: "from-[#fff7ea] to-[#fffdf8]",
    glow: "bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_52%)]",
  },
  notfound: {
    code: "404",
    accent: "from-[#f5f7ff] to-[#fbfbfe]",
    glow: "bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.16),transparent_52%)]",
  },
};

export default function StatusState({
  variant = "empty",
  eyebrow,
  icon,
  title,
  description,
  primaryLabel,
  primaryTo,
  secondaryLabel,
  secondaryTo,
  backLabel,
  compact = false,
}: StatusStateProps) {
  const theme = variantStyles[variant];
  const navigate = useNavigate();

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(routePaths.home);
  }

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-white/75 bg-gradient-to-br ${theme.accent} shadow-[0_18px_50px_rgba(15,23,42,0.06)] ${
        compact ? "p-6" : "px-6 py-10 md:px-10 md:py-12"
      }`}
    >
      <div className={`pointer-events-none absolute inset-0 ${theme.glow}`} />
      <div className={`relative mx-auto ${compact ? "max-w-none" : "max-w-3xl"} text-center`}>
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-lg border border-white/80 bg-white/80 shadow-[0_16px_36px_rgba(15,23,42,0.08)] md:h-28 md:w-28">
          {icon ? (
            <div className="text-4xl text-slate-400">{icon}</div>
          ) : (
            <div className="text-3xl font-semibold tracking-[0.12em] text-slate-300 md:text-4xl">{theme.code}</div>
          )}
        </div>

        <div className="mt-6 flex justify-center">
          <Tag color={variant === "forbidden" ? "orange" : variant === "notfound" ? "blue" : "default"}>
            {eyebrow ?? (variant === "forbidden" ? "无权限访问" : variant === "notfound" ? "页面不存在" : "暂无内容")}
          </Tag>
        </div>

        <h1 className={`${compact ? "mt-4 text-2xl" : "mt-5 text-3xl md:text-4xl"} font-semibold text-slate-900`}>
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-slate-600 md:text-base">{description}</p>

        {backLabel || (primaryLabel && primaryTo) || (secondaryLabel && secondaryTo) ? (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {backLabel ? (
              <Button icon={<ArrowLeftOutlined />} size="large" className="rounded-lg border-slate-200 bg-white px-6" onClick={handleBack}>
                {backLabel}
              </Button>
            ) : null}
            {primaryLabel && primaryTo ? (
              <Link to={primaryTo}>
                <Button type="primary" size="large" className="rounded-lg border-none bg-[#2a6df4] px-6">
                  {primaryLabel}
                </Button>
              </Link>
            ) : null}
            {secondaryLabel && secondaryTo ? (
              <Link to={secondaryTo}>
                <Button size="large" className="rounded-lg border-slate-200 bg-white px-6">
                  {secondaryLabel}
                </Button>
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

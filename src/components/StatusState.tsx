import { Button, Tag } from "antd";
import { Link } from "react-router-dom";

type StatusVariant = "empty" | "forbidden" | "notfound";

interface StatusStateProps {
  variant?: StatusVariant;
  eyebrow?: string;
  title: string;
  description: string;
  primaryLabel?: string;
  primaryTo?: string;
  secondaryLabel?: string;
  secondaryTo?: string;
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
  title,
  description,
  primaryLabel,
  primaryTo,
  secondaryLabel,
  secondaryTo,
  compact = false,
}: StatusStateProps) {
  const theme = variantStyles[variant];

  return (
    <div
      className={`relative overflow-hidden rounded-[32px] border border-white/75 bg-gradient-to-br ${theme.accent} shadow-[0_18px_50px_rgba(15,23,42,0.06)] ${
        compact ? "p-6" : "px-6 py-10 md:px-10 md:py-12"
      }`}
    >
      <div className={`pointer-events-none absolute inset-0 ${theme.glow}`} />
      <div className={`relative mx-auto ${compact ? "max-w-none" : "max-w-3xl"} text-center`}>
        <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border border-white/80 bg-white/80 shadow-[0_16px_36px_rgba(15,23,42,0.08)]">
          <div className="text-4xl font-semibold tracking-[0.18em] text-slate-300">{theme.code}</div>
        </div>

        <div className="mt-6 flex justify-center">
          <Tag color={variant === "forbidden" ? "orange" : variant === "notfound" ? "blue" : "default"}>
            {eyebrow ?? (variant === "forbidden" ? "无权限" : variant === "notfound" ? "页面不存在" : "暂无内容")}
          </Tag>
        </div>

        <h1 className={`${compact ? "mt-4 text-2xl" : "mt-5 text-3xl md:text-4xl"} font-semibold text-slate-900`}>
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-slate-600 md:text-base">{description}</p>

        {(primaryLabel && primaryTo) || (secondaryLabel && secondaryTo) ? (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {primaryLabel && primaryTo ? (
              <Link to={primaryTo}>
                <Button type="primary" size="large" className="rounded-full border-none bg-[#2a6df4] px-6">
                  {primaryLabel}
                </Button>
              </Link>
            ) : null}
            {secondaryLabel && secondaryTo ? (
              <Link to={secondaryTo}>
                <Button size="large" className="rounded-full border-slate-200 bg-white px-6">
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

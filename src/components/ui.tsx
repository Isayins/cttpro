import type { HTMLAttributes, PropsWithChildren } from "react";

export function Card({
  className = "",
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={`rounded-[28px] border border-slate-200/70 bg-white/90 shadow-[0_18px_40px_rgba(18,34,48,0.08)] backdrop-blur-xl ${className}`} {...props} />;
}

export function CardContent({
  className = "",
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={`p-5 ${className}`} {...props} />;
}

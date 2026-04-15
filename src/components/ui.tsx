import type { HTMLAttributes, PropsWithChildren } from "react";
import React from "react";

type ButtonVariant = "primary" | "danger" | "ghost";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: PropsWithChildren<ButtonProps>) {
  const base = "btn";
  const variantClass =
    variant === "danger"
      ? "btn-danger"
      : variant === "ghost"
      ? "btn-ghost"
      : "btn-primary";

  return <button className={`${base} ${variantClass} ${className}`} {...props} />;
}

export function Card({
  className = "",
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={`card ${className}`} {...props} />;
}

export function CardContent({
  className = "",
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return <div className={`card-content ${className}`} {...props} />;
}
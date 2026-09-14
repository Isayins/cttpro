import type { ReactNode } from "react";

import Footer from "../components/Footer";
import Header from "../components/Header";
import { layoutContentWidthClass, type LayoutContentWidth } from "./layoutWidth";

interface Props {
  children: ReactNode;
  variant?: "default" | "clean" | "bare";
  contentWidth?: LayoutContentWidth;
  mode?: "page" | "workspace";
  backdrop?: "default" | "liquid";
}

const LIQUID_GLASS_BACKGROUND =
  "radial-gradient(70% 60% at 8% 0%, rgba(90,150,255,0.28), transparent 55%), radial-gradient(65% 55% at 92% 4%, rgba(120,205,255,0.24), transparent 55%), radial-gradient(72% 62% at 85% 96%, rgba(120,220,200,0.22), transparent 58%), radial-gradient(70% 60% at 12% 98%, rgba(255,196,130,0.18), transparent 58%), linear-gradient(180deg, #eef4ff 0%, #eef7ff 45%, #eafaf4 100%)";

export default function MainLayout({ children, variant = "default", contentWidth = "default", mode = "page", backdrop = "default" }: Props) {
  const contentWidthClass = layoutContentWidthClass[contentWidth];
  const isWorkspace = mode === "workspace";
  const isBare = variant === "bare";
  const headerVariant = isBare ? "default" : variant;
  const isLiquid = backdrop === "liquid";

  return (
    <div
      className={
        isLiquid
          ? "liquid-glass min-h-screen text-slate-900"
          : "min-h-screen bg-[radial-gradient(circle_at_top,rgba(69,139,255,0.16),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(255,183,77,0.14),transparent_20%),linear-gradient(180deg,#eef5ff_0%,#f6f9fd_36%,#edf3fb_100%)] text-slate-900"
      }
      style={isLiquid ? { background: LIQUID_GLASS_BACKGROUND } : undefined}
    >
      {isBare ? null : <Header variant={headerVariant} contentWidth={contentWidth} />}
      <main className={isWorkspace ? "min-h-[calc(100vh-64px)] pb-6 pt-5 md:pt-6" : "pb-12 pt-5 md:pt-6"}>
        <div className={`mx-auto ${contentWidthClass} px-4 md:px-6`}>{children}</div>
      </main>
      {isWorkspace ? null : <Footer contentWidth={contentWidth} />}
    </div>
  );
}

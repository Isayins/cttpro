import type { ReactNode } from "react";

import Footer from "../components/Footer";
import Header from "../components/Header";
import { layoutContentWidthClass, type LayoutContentWidth } from "./layoutWidth";

interface Props {
  children: ReactNode;
  variant?: "default" | "clean" | "bare";
  contentWidth?: LayoutContentWidth;
  mode?: "page" | "workspace";
}

export default function MainLayout({ children, variant = "default", contentWidth = "default", mode = "page" }: Props) {
  const contentWidthClass = layoutContentWidthClass[contentWidth];
  const isWorkspace = mode === "workspace";
  const isBare = variant === "bare";
  const headerVariant = isBare ? "default" : variant;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(69,139,255,0.16),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(255,183,77,0.14),transparent_20%),linear-gradient(180deg,#eef5ff_0%,#f6f9fd_36%,#edf3fb_100%)] text-slate-900">
      {isBare ? null : <Header variant={headerVariant} contentWidth={contentWidth} />}
      <main className={isWorkspace ? "min-h-[calc(100vh-64px)] pb-6 pt-5 md:pt-6" : "pb-12 pt-5 md:pt-6"}>
        <div className={`mx-auto ${contentWidthClass} px-4 md:px-6`}>{children}</div>
      </main>
      {isWorkspace || isBare ? null : <Footer contentWidth={contentWidth} />}
    </div>
  );
}

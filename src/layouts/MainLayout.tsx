import type { ReactNode } from "react";

import Footer from "../components/Footer";
import Header from "../components/Header";

interface Props {
  children: ReactNode;
}

export default function MainLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(69,139,255,0.16),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(255,183,77,0.14),transparent_20%),linear-gradient(180deg,#eef5ff_0%,#f6f9fd_36%,#edf3fb_100%)] text-slate-900">
      <Header />
      <main className="pb-12 pt-5 md:pt-6">
        <div className="mx-auto max-w-6xl px-4 md:px-6">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

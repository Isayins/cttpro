import { layoutContentWidthClass, type LayoutContentWidth } from "../layouts/layoutWidth";

interface FooterProps {
  contentWidth?: LayoutContentWidth;
}

export default function Footer({ contentWidth = "default" }: FooterProps) {
  const contentWidthClass = layoutContentWidthClass[contentWidth];
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/50 bg-white/45 backdrop-blur-xl">
      <div className={`mx-auto flex ${contentWidthClass} flex-col gap-2 px-4 py-6 text-center text-sm text-slate-500 md:px-6`}>
        <p>版权所有 © {currentYear} IDNCAR</p>
        <p>
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="打开工信部备案管理系统查询浙ICP备2025194794号-1"
            className="transition-colors hover:text-slate-700"
          >
            浙ICP备2025194794号-1
          </a>
        </p>
      </div>
    </footer>
  );
}

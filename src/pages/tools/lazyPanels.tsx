import { lazy } from "react";

export const Base64ToolPanel = lazy(() =>
  import("./Base64ToolPanel").then((module) => ({
    default: module.Base64ToolPanel,
  })),
);
export const ColorToolPanel = lazy(() =>
  import("./ColorToolPanel").then((module) => ({
    default: module.ColorToolPanel,
  })),
);
export const CronToolPanel = lazy(() =>
  import("./CronToolPanel").then((module) => ({
    default: module.CronToolPanel,
  })),
);
export const CsvJsonToolPanel = lazy(() =>
  import("./CsvJsonToolPanel").then((module) => ({
    default: module.CsvJsonToolPanel,
  })),
);
export const CurlCodeToolPanel = lazy(() =>
  import("./CurlCodeToolPanel").then((module) => ({
    default: module.CurlCodeToolPanel,
  })),
);
export const DiagnosticsToolPanel = lazy(() =>
  import("./DiagnosticsToolPanel").then((module) => ({
    default: module.DiagnosticsToolPanel,
  })),
);
export const HashToolPanel = lazy(() =>
  import("./HashToolPanel").then((module) => ({
    default: module.HashToolPanel,
  })),
);
export const HtmlEntityToolPanel = lazy(() =>
  import("./HtmlEntityToolPanel").then((module) => ({
    default: module.HtmlEntityToolPanel,
  })),
);
export const JavaDecompileToolPanel = lazy(() =>
  import("./JavaDecompileToolPanel").then((module) => ({
    default: module.JavaDecompileToolPanel,
  })),
);
export const JsonFormatToolPanel = lazy(() =>
  import("./JsonFormatToolPanel").then((module) => ({
    default: module.JsonFormatToolPanel,
  })),
);
export const JsonTypesToolPanel = lazy(() =>
  import("./JsonTypesToolPanel").then((module) => ({
    default: module.JsonTypesToolPanel,
  })),
);
export const JwtToolPanel = lazy(() =>
  import("./JwtToolPanel").then((module) => ({
    default: module.JwtToolPanel,
  })),
);
export const PasswordToolPanel = lazy(() =>
  import("./PasswordToolPanel").then((module) => ({
    default: module.PasswordToolPanel,
  })),
);
export const QueryParamsToolPanel = lazy(() =>
  import("./QueryParamsToolPanel").then((module) => ({
    default: module.QueryParamsToolPanel,
  })),
);
export const QrcodeToolPanel = lazy(() =>
  import("./QrcodeToolPanel").then((module) => ({
    default: module.QrcodeToolPanel,
  })),
);
export const QrDecodeToolPanel = lazy(() =>
  import("./QrDecodeToolPanel").then((module) => ({
    default: module.QrDecodeToolPanel,
  })),
);
export const RegexToolPanel = lazy(() =>
  import("./RegexToolPanel").then((module) => ({
    default: module.RegexToolPanel,
  })),
);
export const SubConvertToolPanel = lazy(() =>
  import("./SubConvertToolPanel").then((module) => ({
    default: module.SubConvertToolPanel,
  })),
);
export const TextDiffToolPanel = lazy(() =>
  import("./TextDiffToolPanel").then((module) => ({
    default: module.TextDiffToolPanel,
  })),
);
export const TextTransformToolPanel = lazy(() =>
  import("./TextTransformToolPanel").then((module) => ({
    default: module.TextTransformToolPanel,
  })),
);
export const TimestampToolPanel = lazy(() =>
  import("./TimestampToolPanel").then((module) => ({
    default: module.TimestampToolPanel,
  })),
);
export const UrlCodecToolPanel = lazy(() =>
  import("./UrlCodecToolPanel").then((module) => ({
    default: module.UrlCodecToolPanel,
  })),
);
export const UuidToolPanel = lazy(() =>
  import("./UuidToolPanel").then((module) => ({
    default: module.UuidToolPanel,
  })),
);

export function ToolPanelLoadingFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-sm text-slate-500">
      工具加载中...
    </div>
  );
}

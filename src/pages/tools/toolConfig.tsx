import {
  ApiOutlined,
  BgColorsOutlined,
  BranchesOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  FileExcelOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  Html5Outlined,
  IdcardOutlined,
  KeyOutlined,
  LinkOutlined,
  LockOutlined,
  OrderedListOutlined,
  QrcodeOutlined,
  SyncOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TableOutlined,
} from "@ant-design/icons";

import type { ToolCategory, ToolConfigItem, ToolType } from "./types";

export const toolCategoryConfig: Record<ToolCategory, { name: string; tone: string }> = {
  data: { name: "数据处理", tone: "blue" },
  codec: { name: "编码转换", tone: "green" },
  text: { name: "文本处理", tone: "cyan" },
  security: { name: "安全生成", tone: "purple" },
  debug: { name: "开发调试", tone: "orange" },
  network: { name: "网络代理", tone: "geekblue" },
};

export const recommendedTools: ToolType[] = ["json", "subconvert", "timestamp", "base64", "regex", "qrcode"];

export const toolConfig: Record<ToolType, ToolConfigItem> = {
  json: { name: "JSON 格式化", description: "格式化、压缩和校验 JSON", category: "data", icon: CodeOutlined, color: "#2563eb", bgColor: "bg-blue-100" },
  jsontypes: { name: "JSON 转 TS 类型", description: "从 JSON 样例生成 TypeScript 类型", category: "data", icon: CodeOutlined, color: "#7c3aed", bgColor: "bg-violet-100" },
  subconvert: { name: "订阅转换", description: "生成 SubConverter 转换链接和客户端导入链接", category: "network", icon: ApiOutlined, color: "#1d4ed8", bgColor: "bg-blue-100" },
  timestamp: { name: "时间戳转换", description: "Unix 时间戳和日期互转", category: "data", icon: ClockCircleOutlined, color: "#2f855a", bgColor: "bg-green-100" },
  base64: { name: "Base64 编解码", description: "文本 Base64 编码与解码", category: "codec", icon: KeyOutlined, color: "#c0841a", bgColor: "bg-amber-100" },
  url: { name: "URL 编解码", description: "URL 百分号编码与解码", category: "codec", icon: LinkOutlined, color: "#dc2626", bgColor: "bg-rose-100" },
  query: { name: "URL 参数解析", description: "拆解查询参数并格式化", category: "codec", icon: TableOutlined, color: "#0d9488", bgColor: "bg-teal-100" },
  curlcode: { name: "cURL 转代码", description: "把 cURL 转成常用请求代码", category: "debug", icon: ApiOutlined, color: "#0f766e", bgColor: "bg-teal-100" },
  regex: { name: "正则测试", description: "测试表达式匹配和分组", category: "debug", icon: SearchOutlined, color: "#7c2d12", bgColor: "bg-orange-100" },
  diff: { name: "文本 Diff", description: "逐行比较两段文本差异", category: "text", icon: BranchesOutlined, color: "#475569", bgColor: "bg-slate-100" },
  color: { name: "颜色转换", description: "HEX、RGB 和 HSL 互转", category: "text", icon: BgColorsOutlined, color: "#be185d", bgColor: "bg-pink-100" },
  password: { name: "密码生成", description: "按规则生成随机密码", category: "security", icon: LockOutlined, color: "#15803d", bgColor: "bg-emerald-100" },
  html: { name: "HTML 实体转义", description: "HTML 特殊字符转义与还原", category: "codec", icon: Html5Outlined, color: "#c2410c", bgColor: "bg-orange-100" },
  csv: { name: "CSV 转 JSON", description: "CSV/TSV 表格内容转 JSON", category: "data", icon: FileExcelOutlined, color: "#16a34a", bgColor: "bg-green-100" },
  text: { name: "文本整理", description: "去重、排序、大小写和编号", category: "text", icon: OrderedListOutlined, color: "#0369a1", bgColor: "bg-sky-100" },
  diagnostics: { name: "接口诊断", description: "检测接口延迟和请求环境", category: "debug", icon: ApiOutlined, color: "#4f46e5", bgColor: "bg-indigo-100" },
  jwt: { name: "JWT 解析", description: "解析 Header、Payload 和时间字段", category: "security", icon: SafetyCertificateOutlined, color: "#4f46e5", bgColor: "bg-indigo-100" },
  uuid: { name: "UUID 生成", description: "批量生成 UUID v4", category: "security", icon: IdcardOutlined, color: "#0891b2", bgColor: "bg-cyan-100" },
  hash: { name: "文本哈希", description: "计算 SHA 系列文本摘要", category: "security", icon: FileProtectOutlined, color: "#9333ea", bgColor: "bg-purple-100" },
  cron: { name: "Cron 表达式生成", description: "生成常用定时表达式", category: "debug", icon: ClockCircleOutlined, color: "#0f766e", bgColor: "bg-teal-100" },
  qrcode: { name: "二维码生成", description: "根据文本或链接生成二维码", category: "codec", icon: QrcodeOutlined, color: "#7c3aed", bgColor: "bg-violet-100" },
  qrdecode: { name: "二维码解析", description: "上传图片解析二维码内容", category: "codec", icon: QrcodeOutlined, color: "#0d9488", bgColor: "bg-teal-100" },
  javadecompile: { name: "Java 字节码查看", description: "使用 javap 查看 class 文件结构和指令", category: "debug", icon: FileTextOutlined, color: "#ea580c", bgColor: "bg-orange-100" },
  wheel: { name: "随机转盘", description: "手动输入选项并旋转抽取结果", category: "text", icon: SyncOutlined, color: "#db2777", bgColor: "bg-pink-100" },
};

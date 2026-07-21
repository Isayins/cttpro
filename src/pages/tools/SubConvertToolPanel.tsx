import { ApiOutlined, CopyOutlined, DeleteOutlined, ExportOutlined, LinkOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Input, Row, Select, Space, Switch, Tag, message } from "antd";

import { ToolTextResult } from "./ToolResultOutput";
import {
  subConvertBackendPresets,
  subConvertConfigPresets,
  subscriptionTargetOptions,
} from "./subConvertUtils";
import type { useSubConvertTool } from "./useSubConvertTool";

const { TextArea } = Input;

type SubConvertToolPanelProps = ReturnType<typeof useSubConvertTool> & {
  onCopy: () => void;
};

type UrlResultProps = {
  label: string;
  value: string;
  placeholder: string;
};

async function copyValue(value: string) {
  if (!value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    message.success("已复制");
  } catch {
    message.error("复制失败，请检查浏览器剪贴板权限");
  }
}

function openUrl(value: string) {
  if (!value) {
    return;
  }
  window.open(value, "_blank", "noopener,noreferrer");
}

function UrlResult({ label, value, placeholder }: UrlResultProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <Space size={4}>
          <Button type="text" size="small" disabled={!value} aria-label={`复制${label}`} title={`复制${label}`} icon={<CopyOutlined />} onClick={() => void copyValue(value)}>
            复制
          </Button>
          <Button type="text" size="small" disabled={!value} aria-label={`打开${label}`} title={`打开${label}`} icon={<ExportOutlined />} onClick={() => openUrl(value)}>
            打开
          </Button>
        </Space>
      </div>
      <TextArea rows={3} readOnly value={value} placeholder={placeholder} className="bg-slate-50 font-mono text-xs" />
    </div>
  );
}

export function SubConvertToolPanel({
  input,
  target,
  backendUrl,
  shortLinkTemplate,
  outputName,
  configUrl,
  includeFilter,
  excludeFilter,
  emoji,
  udp,
  tfo,
  skipCertVerify,
  appendType,
  sort,
  convertedUrl,
  shortLinkUrl,
  clientLinks,
  stats,
  output,
  copied,
  error,
  setInput,
  setTarget,
  setBackendUrl,
  setShortLinkTemplate,
  setOutputName,
  setConfigUrl,
  setIncludeFilter,
  setExcludeFilter,
  setEmoji,
  setUdp,
  setTfo,
  setSkipCertVerify,
  setAppendType,
  setSort,
  generate,
  clear,
  onCopy,
}: SubConvertToolPanelProps) {
  const statItems = [
    { label: "源链接", value: stats?.total ?? 0 },
    { label: "去重后", value: stats?.unique ?? 0 },
    { label: "订阅", value: stats?.subscriptions ?? 0 },
    { label: "节点", value: stats?.nodes ?? 0 },
    { label: "未识别", value: stats?.unknown ?? 0 },
  ];

  return (
    <Row gutter={[18, 18]}>
      <Col xs={24} xl={13}>
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-slate-700">源订阅 / 节点链接</label>
              {stats?.duplicates ? <Tag color="gold">重复 {stats.duplicates}</Tag> : null}
            </div>
            <TextArea
              rows={8}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="https://example.com/sub&#10;vmess://...&#10;trojan://..."
              className="font-mono text-xs"
            />
          </div>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={10}>
              <label className="mb-2 block text-sm font-medium text-slate-700">目标客户端</label>
              <Select className="w-full" value={target} options={subscriptionTargetOptions} onChange={setTarget} />
            </Col>
            <Col xs={24} md={14}>
              <label className="mb-2 block text-sm font-medium text-slate-700">配置名称</label>
              <Input value={outputName} onChange={(event) => setOutputName(event.target.value)} placeholder="IDNCAR Subscription" />
            </Col>
          </Row>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">转换后端</label>
            <Space.Compact className="w-full">
              <Select
                className="w-[168px] shrink-0"
                options={subConvertBackendPresets}
                value={subConvertBackendPresets.some((item) => item.value === backendUrl) ? backendUrl : undefined}
                placeholder="预设"
                onChange={setBackendUrl}
              />
              <Input value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} placeholder="https://sub.example.com/sub" />
            </Space.Compact>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">远程配置</label>
            <Space.Compact className="w-full">
              <Select
                className="w-[168px] shrink-0"
                options={subConvertConfigPresets}
                value={subConvertConfigPresets.some((item) => item.value === configUrl) ? configUrl : undefined}
                placeholder="预设"
                onChange={setConfigUrl}
              />
              <Input value={configUrl} onChange={(event) => setConfigUrl(event.target.value)} placeholder="https://.../config.ini" />
            </Space.Compact>
          </div>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <label className="mb-2 block text-sm font-medium text-slate-700">包含过滤</label>
              <Input value={includeFilter} onChange={(event) => setIncludeFilter(event.target.value)} placeholder="HK|SG|US" />
            </Col>
            <Col xs={24} md={12}>
              <label className="mb-2 block text-sm font-medium text-slate-700">排除过滤</label>
              <Input value={excludeFilter} onChange={(event) => setExcludeFilter(event.target.value)} placeholder="官网|过期|倍率" />
            </Col>
          </Row>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">短链模板</label>
            <Input value={shortLinkTemplate} onChange={(event) => setShortLinkTemplate(event.target.value)} placeholder="https://short.example.com/short?url={url}" />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {[
              { label: "Emoji", checked: emoji, onChange: setEmoji },
              { label: "UDP", checked: udp, onChange: setUdp },
              { label: "TFO", checked: tfo, onChange: setTfo },
              { label: "跳过证书", checked: skipCertVerify, onChange: setSkipCertVerify },
              { label: "追加类型", checked: appendType, onChange: setAppendType },
              { label: "节点排序", checked: sort, onChange: setSort },
            ].map((item) => (
              <label key={item.label} className="flex min-h-10 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="min-w-0 truncate">{item.label}</span>
                <Switch size="small" checked={item.checked} onChange={item.onChange} />
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="primary" icon={<ApiOutlined />} onClick={generate} className="min-w-0 flex-1">
              生成转换链接
            </Button>
            <Button icon={<CopyOutlined />} disabled={!output} onClick={onCopy}>
              复制结果
            </Button>
            <Button icon={<DeleteOutlined />} onClick={clear}>
              清空
            </Button>
          </div>
        </div>
      </Col>

      <Col xs={24} xl={11}>
        <div className="space-y-5">
          {error ? <Alert type="error" showIcon message={error} /> : null}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 xl:grid-cols-5">
            {statItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-xs text-slate-500">{item.label}</div>
                <div className="mt-1 text-xl font-semibold leading-none text-slate-900">{item.value}</div>
              </div>
            ))}
          </div>

          <UrlResult label="转换链接" value={convertedUrl} placeholder="生成后的 SubConverter 链接" />
          <UrlResult label="短链请求" value={shortLinkUrl} placeholder="配置短链模板后生成" />

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <LinkOutlined />
              客户端导入
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {clientLinks.length > 0 ? (
                clientLinks.map((item) => (
                  <div key={item.label} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2">
                    <span className="min-w-0 truncate text-sm text-slate-700">{item.label}</span>
                    <Space size={2}>
                      <Button type="text" size="small" aria-label={`复制 ${item.label} 导入链接`} title="复制导入链接" icon={<CopyOutlined />} onClick={() => void copyValue(item.value)} />
                      <Button type="text" size="small" aria-label={`打开 ${item.label}`} title="打开客户端" icon={<ExportOutlined />} onClick={() => openUrl(item.value)} />
                    </Space>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-400 sm:col-span-2">
                  生成后显示导入链接
                </div>
              )}
            </div>
          </div>

          <ToolTextResult label="完整结果" value={output} copied={copied} onCopy={onCopy} rows={8} placeholder="生成结果会显示在这里" />
        </div>
      </Col>
    </Row>
  );
}

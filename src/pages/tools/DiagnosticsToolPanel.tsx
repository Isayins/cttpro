import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Row, Slider } from "antd";

import { ToolTextResult } from "./ToolResultOutput";

type DiagnosticsToolPanelProps = {
  count: number;
  output: string;
  copied: boolean;
  error: string | null;
  running: boolean;
  onCountChange: (count: number) => void;
  onRun: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function DiagnosticsToolPanel({
  count,
  output,
  copied,
  error,
  running,
  onCountChange,
  onRun,
  onClear,
  onCopy,
}: DiagnosticsToolPanelProps) {
  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="接口诊断失败" description={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={9}>
          <label className="mb-2 block text-sm font-medium text-gray-700">连续请求次数：{count}</label>
          <Slider min={1} max={8} value={count} onChange={(value) => onCountChange(Number(value))} />
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            <div className="font-medium text-slate-800">诊断内容</div>
            <div className="mt-2">会请求 Java 后端诊断接口，测量往返延迟、前后端时钟偏移、登录用户 ID 和请求头摘要。</div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="primary" loading={running} onClick={onRun} style={{ flex: 1 }}>
              开始诊断
            </Button>
            <Button icon={<DeleteOutlined />} onClick={onClear} />
          </div>
        </Col>
        <Col xs={24} lg={15}>
          <ToolTextResult label="诊断结果" value={output} copied={copied} onCopy={onCopy} rows={18} placeholder="诊断结果会显示在这里" />
        </Col>
      </Row>
    </div>
  );
}

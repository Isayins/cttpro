import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Input, Row } from "antd";

import { ToolTextResult } from "./ToolResultOutput";

const { TextArea } = Input;

type RegexToolPanelProps = {
  pattern: string;
  flags: string;
  sample: string;
  output: string;
  copied: boolean;
  error: string | null;
  onPatternChange: (value: string) => void;
  onFlagsChange: (value: string) => void;
  onSampleChange: (value: string) => void;
  onTest: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function RegexToolPanel({
  pattern,
  flags,
  sample,
  output,
  copied,
  error,
  onPatternChange,
  onFlagsChange,
  onSampleChange,
  onTest,
  onClear,
  onCopy,
}: RegexToolPanelProps) {
  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="正则测试失败" description={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px]">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">表达式</label>
              <Input aria-label="正则表达式" value={pattern} onChange={(event) => onPatternChange(event.target.value)} placeholder="例如 \\b\\w+@\\w+\\.com\\b" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Flags</label>
              <Input aria-label="正则 Flags" value={flags} onChange={(event) => onFlagsChange(event.target.value)} placeholder="gim" />
            </div>
          </div>
          <label className="mb-2 mt-4 block text-sm font-medium text-gray-700">测试文本</label>
          <TextArea aria-label="正则测试文本" rows={8} value={sample} onChange={(event) => onSampleChange(event.target.value)} placeholder="输入要匹配的文本" />
          <div className="mt-4 flex gap-2">
            <Button type="primary" onClick={onTest} style={{ flex: 1 }}>
              开始测试
            </Button>
            <Button aria-label="清空" title="清空" icon={<DeleteOutlined />} onClick={onClear} />
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <ToolTextResult label="匹配结果" value={output} copied={copied} onCopy={onCopy} rows={14} placeholder="命中位置、内容和分组会显示在这里" />
        </Col>
      </Row>
    </div>
  );
}

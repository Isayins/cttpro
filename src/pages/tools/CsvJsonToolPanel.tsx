import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Input, Row, Select } from "antd";

import { ToolTextResult } from "./ToolResultOutput";
import type { CsvDelimiter } from "./types";
import { csvDelimiterOptions } from "./toolUtils";

const { TextArea } = Input;

type CsvJsonToolPanelProps = {
  input: string;
  delimiter: CsvDelimiter;
  output: string;
  copied: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onDelimiterChange: (value: CsvDelimiter) => void;
  onConvert: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function CsvJsonToolPanel({
  input,
  delimiter,
  output,
  copied,
  error,
  onInputChange,
  onDelimiterChange,
  onConvert,
  onClear,
  onCopy,
}: CsvJsonToolPanelProps) {
  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="CSV 转换失败" description={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <div className="mb-3">
            <label className="mb-2 block text-sm font-medium text-gray-700">分隔符</label>
            <Select aria-label="分隔符" className="w-full" value={delimiter} onChange={(value: CsvDelimiter) => onDelimiterChange(value)} options={csvDelimiterOptions} />
          </div>
          <label className="mb-2 block text-sm font-medium text-gray-700">CSV/TSV 内容</label>
          <TextArea aria-label="CSV 或 TSV 内容" rows={10} value={input} onChange={(event) => onInputChange(event.target.value)} placeholder={'name,age\nAlice,18\nBob,20'} />
          <div className="mt-4 flex gap-2">
            <Button type="primary" onClick={onConvert} style={{ flex: 1 }}>
              转为 JSON
            </Button>
            <Button aria-label="清空" title="清空" icon={<DeleteOutlined />} onClick={onClear} />
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <ToolTextResult label="JSON 结果" value={output} copied={copied} onCopy={onCopy} rows={14} placeholder="转换后的 JSON 会显示在这里" />
        </Col>
      </Row>
    </div>
  );
}

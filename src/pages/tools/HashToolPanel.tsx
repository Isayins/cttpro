import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Input, Row, Select } from "antd";

import { ToolTextResult } from "./ToolResultOutput";
import type { HashAlgorithm } from "./types";
import { hashAlgorithmOptions } from "./toolUtils";

const { TextArea } = Input;

type HashToolPanelProps = {
  input: string;
  algorithm: HashAlgorithm;
  output: string;
  copied: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onAlgorithmChange: (value: HashAlgorithm) => void;
  onRun: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function HashToolPanel({
  input,
  algorithm,
  output,
  copied,
  error,
  onInputChange,
  onAlgorithmChange,
  onRun,
  onClear,
  onCopy,
}: HashToolPanelProps) {
  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="哈希计算失败" description={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <div className="mb-3">
            <label className="mb-2 block text-sm font-medium text-gray-700">算法</label>
            <Select className="w-full" value={algorithm} onChange={(value: HashAlgorithm) => onAlgorithmChange(value)} options={hashAlgorithmOptions} />
          </div>
          <label className="mb-2 block text-sm font-medium text-gray-700">输入文本</label>
          <TextArea rows={8} value={input} onChange={(event) => onInputChange(event.target.value)} placeholder="输入要计算摘要的文本" />
          <div className="mt-4 flex gap-2">
            <Button type="primary" onClick={onRun} style={{ flex: 1 }}>
              计算哈希
            </Button>
            <Button icon={<DeleteOutlined />} onClick={onClear} />
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <ToolTextResult label="摘要结果" value={output} copied={copied} onCopy={onCopy} rows={8} placeholder="十六进制摘要会显示在这里" />
        </Col>
      </Row>
    </div>
  );
}

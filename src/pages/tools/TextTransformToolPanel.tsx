import { DeleteOutlined } from "@ant-design/icons";
import { Button, Col, Input, Row, Select } from "antd";

import { ToolTextResult } from "./ToolResultOutput";
import type { TextTransformMode } from "./types";
import { textTransformOptions } from "./toolUtils";

const { TextArea } = Input;

type TextTransformToolPanelProps = {
  input: string;
  mode: TextTransformMode;
  output: string;
  copied: boolean;
  onInputChange: (value: string) => void;
  onModeChange: (value: TextTransformMode) => void;
  onTransform: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function TextTransformToolPanel({
  input,
  mode,
  output,
  copied,
  onInputChange,
  onModeChange,
  onTransform,
  onClear,
  onCopy,
}: TextTransformToolPanelProps) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <div className="mb-3">
          <label className="mb-2 block text-sm font-medium text-gray-700">处理方式</label>
          <Select className="w-full" value={mode} onChange={(value: TextTransformMode) => onModeChange(value)} options={textTransformOptions} />
        </div>
        <TextArea rows={10} value={input} onChange={(event) => onInputChange(event.target.value)} placeholder="粘贴需要整理的文本" />
        <div className="mt-4 flex gap-2">
          <Button type="primary" onClick={onTransform} style={{ flex: 1 }}>
            整理文本
          </Button>
          <Button icon={<DeleteOutlined />} onClick={onClear} />
        </div>
      </Col>
      <Col xs={24} lg={12}>
        <ToolTextResult label="输出" value={output} copied={copied} onCopy={onCopy} rows={14} placeholder="整理结果会显示在这里" />
      </Col>
    </Row>
  );
}

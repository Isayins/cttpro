import { DeleteOutlined } from "@ant-design/icons";
import { Button, Col, Input, Row, Slider } from "antd";

import { ToolTextResult } from "./ToolResultOutput";

type UuidToolPanelProps = {
  count: number;
  output: string;
  copied: boolean;
  onCountChange: (count: number) => void;
  onGenerate: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function UuidToolPanel({ count, output, copied, onCountChange, onGenerate, onClear, onCopy }: UuidToolPanelProps) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={10}>
        <label className="mb-2 block text-sm font-medium text-gray-700">生成数量（1 - 50）</label>
        <Input type="number" min={1} max={50} value={count} onChange={(event) => onCountChange(Number(event.target.value))} />
        <div className="mt-4">
          <Slider min={1} max={50} value={count} onChange={(value) => onCountChange(Number(value))} />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="primary" onClick={onGenerate} style={{ flex: 1 }}>
            生成 UUID
          </Button>
          <Button icon={<DeleteOutlined />} onClick={onClear} />
        </div>
      </Col>
      <Col xs={24} lg={14}>
        <ToolTextResult label="UUID v4" value={output} copied={copied} onCopy={onCopy} rows={12} placeholder="生成结果会显示在这里" />
      </Col>
    </Row>
  );
}

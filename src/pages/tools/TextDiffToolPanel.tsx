import { DeleteOutlined } from "@ant-design/icons";
import { Button, Col, Input, Row } from "antd";

import { ToolTextResult } from "./ToolResultOutput";

const { TextArea } = Input;

type TextDiffToolPanelProps = {
  left: string;
  right: string;
  output: string;
  copied: boolean;
  onLeftChange: (value: string) => void;
  onRightChange: (value: string) => void;
  onDiff: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function TextDiffToolPanel({
  left,
  right,
  output,
  copied,
  onLeftChange,
  onRightChange,
  onDiff,
  onClear,
  onCopy,
}: TextDiffToolPanelProps) {
  return (
    <div className="space-y-6">
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <label className="mb-2 block text-sm font-medium text-gray-700">原文本</label>
          <TextArea rows={10} value={left} onChange={(event) => onLeftChange(event.target.value)} placeholder="粘贴原始文本" />
        </Col>
        <Col xs={24} lg={12}>
          <label className="mb-2 block text-sm font-medium text-gray-700">新文本</label>
          <TextArea rows={10} value={right} onChange={(event) => onRightChange(event.target.value)} placeholder="粘贴对比文本" />
        </Col>
      </Row>
      <div className="flex gap-2">
        <Button type="primary" onClick={onDiff} style={{ flex: 1 }}>
          生成 Diff
        </Button>
        <Button icon={<DeleteOutlined />} onClick={onClear} />
      </div>
      <ToolTextResult label="差异结果" value={output} copied={copied} onCopy={onCopy} rows={14} placeholder="+ 新增，- 删除，空格表示相同" />
    </div>
  );
}

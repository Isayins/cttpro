import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Input, Row } from "antd";

import { ToolTextResult } from "./ToolResultOutput";

const { TextArea } = Input;

type QueryParamsToolPanelProps = {
  input: string;
  output: string;
  copied: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onParse: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function QueryParamsToolPanel({
  input,
  output,
  copied,
  error,
  onInputChange,
  onParse,
  onClear,
  onCopy,
}: QueryParamsToolPanelProps) {
  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="URL 参数解析失败" description={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <label className="mb-2 block text-sm font-medium text-gray-700">URL 或查询字符串</label>
          <TextArea
            aria-label="URL 或查询字符串"
            rows={7}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="https://example.com/search?q=test&page=1 或 ?q=test&page=1"
          />
          <div className="mt-4 flex gap-2">
            <Button type="primary" onClick={onParse} style={{ flex: 1 }}>
              解析参数
            </Button>
            <Button aria-label="清空" title="清空" icon={<DeleteOutlined />} onClick={onClear} />
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <ToolTextResult label="参数结果" value={output} copied={copied} onCopy={onCopy} rows={12} placeholder="参数表和 JSON 会显示在这里" />
        </Col>
      </Row>
    </div>
  );
}

import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Input, Row } from "antd";

import { ToolTextResult } from "./ToolResultOutput";
import type { CurlCodeMode } from "./types";

const { TextArea } = Input;

type CurlCodeToolPanelProps = {
  input: string;
  mode: CurlCodeMode;
  output: string;
  copied: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onModeChange: (value: CurlCodeMode) => void;
  onGenerate: () => void;
  onClear: () => void;
  onCopy: () => void;
};

const modeOptions: { label: string; value: CurlCodeMode }[] = [
  { label: "Fetch", value: "fetch" },
  { label: "Axios", value: "axios" },
  { label: "Python", value: "python" },
];

export function CurlCodeToolPanel({
  input,
  mode,
  output,
  copied,
  error,
  onInputChange,
  onModeChange,
  onGenerate,
  onClear,
  onCopy,
}: CurlCodeToolPanelProps) {
  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="cURL 转换失败" description={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <div className="mb-3 flex flex-wrap gap-2">
            {modeOptions.map((item) => (
              <Button key={item.value} type={mode === item.value ? "primary" : "default"} onClick={() => onModeChange(item.value)}>
                {item.label}
              </Button>
            ))}
          </div>
          <TextArea
            rows={10}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder={`curl 'https://api.example.com/users' -X POST -H 'Content-Type: application/json' --data-raw '{"name":"Alice"}'`}
          />
          <div className="mt-4 flex gap-2">
            <Button type="primary" onClick={onGenerate} style={{ flex: 1 }}>
              生成代码
            </Button>
            <Button icon={<DeleteOutlined />} onClick={onClear} />
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <ToolTextResult label="代码片段" value={output} copied={copied} onCopy={onCopy} rows={16} placeholder="Fetch、Axios 或 Python requests 代码会显示在这里" />
        </Col>
      </Row>
    </div>
  );
}

import { useRef, type ChangeEvent, type DragEvent } from "react";
import { CopyOutlined, DeleteOutlined, InboxOutlined, QrcodeOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Row } from "antd";

import { CopyResultButton } from "./ToolResultOutput";

type QrDecodeToolPanelProps = {
  fileName: string;
  previewUrl: string;
  output: string;
  copied: boolean;
  error: string | null;
  decoding: boolean;
  onFileDecode: (file: File) => void;
  onClear: () => void;
  onCopy: () => void;
};

export function QrDecodeToolPanel({
  fileName,
  previewUrl,
  output,
  copied,
  error,
  decoding,
  onFileDecode,
  onClear,
  onCopy,
}: QrDecodeToolPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileDecode(file);
    }
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      onFileDecode(file);
    }
  };

  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="二维码解析失败" description={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">上传二维码图片</label>
              <div
                className="cursor-pointer rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center transition-colors hover:border-blue-400"
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
              >
                <InboxOutlined style={{ fontSize: 42, color: "#9CA3AF", marginBottom: 12 }} />
                <div className="font-medium text-gray-700">点击或拖入图片</div>
                <div className="mt-1 text-sm text-gray-400">支持 PNG、JPG、WebP 等常见图片</div>
                {fileName ? <div className="mt-3 break-all text-sm text-green-600">已选择：{fileName}</div> : null}
                <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </div>
            </div>

            <div className="flex min-h-[260px] items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
              {previewUrl ? (
                <img src={previewUrl} alt={fileName || "二维码图片预览"} className="max-h-[320px] w-full object-contain" />
              ) : (
                <div className="text-center text-gray-400">
                  <QrcodeOutlined style={{ fontSize: 54 }} />
                  <p className="mt-3">图片预览区域</p>
                </div>
              )}
            </div>

            <Button icon={<DeleteOutlined />} onClick={onClear} block>
              清空图片
            </Button>
          </div>
        </Col>

        <Col xs={24} lg={14}>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">解析结果</label>
            <CopyResultButton value={output} copied={copied} onCopy={onCopy} />
          </div>
          <div className="min-h-[420px] overflow-auto rounded-xl bg-gray-900 p-4">
            {decoding ? (
              <div className="flex h-full min-h-[388px] items-center justify-center text-gray-400">
                <div className="text-center">
                  <QrcodeOutlined style={{ fontSize: 52 }} />
                  <p className="mt-4">正在解析二维码...</p>
                </div>
              </div>
            ) : output ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-sm text-gray-300">{output}</pre>
            ) : (
              <div className="flex h-full min-h-[388px] items-center justify-center text-gray-500">
                <div className="text-center">
                  <CopyOutlined style={{ fontSize: 52 }} />
                  <p className="mt-4">解析结果会显示在这里</p>
                </div>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
}

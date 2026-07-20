import type { ChangeEvent } from "react";
import { DeleteOutlined, FileTextOutlined, UploadOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Input, Row } from "antd";

import { CopyResultButton } from "./ToolResultOutput";

const { TextArea } = Input;

type JavaDecompileToolPanelProps = {
  classContent: string;
  output: string;
  copied: boolean;
  error: string | null;
  fileName: string;
  decompiling: boolean;
  onClassContentChange: (value: string) => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRun: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function JavaDecompileToolPanel({
  classContent,
  output,
  copied,
  error,
  fileName,
  decompiling,
  onClassContentChange,
  onFileUpload,
  onRun,
  onClear,
  onCopy,
}: JavaDecompileToolPanelProps) {
  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="Java 字节码查看失败" description={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">上传 Class 文件</label>
              <label
                className="cursor-pointer rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center transition-colors hover:border-blue-400"
              >
                <UploadOutlined style={{ fontSize: 42, color: "#9CA3AF", marginBottom: 12 }} />
                <div className="font-medium text-gray-700">点击上传 .class 文件</div>
                <div className="mt-1 text-sm text-gray-400">文件会发送到 Java 后端，最大 2 MB</div>
                {fileName ? <div className="mt-3 text-sm text-green-600">已选择：{fileName}</div> : null}
                <input type="file" accept=".class" onChange={onFileUpload} className="hidden" />
              </label>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">或直接输入 Base64 字节码</label>
              <TextArea rows={8} value={classContent} onChange={(event) => onClassContentChange(event.target.value)} placeholder="粘贴 .class 文件对应的 Base64 内容" />
            </div>

            <div className="flex gap-2">
              <Button type="primary" icon={<FileTextOutlined />} loading={decompiling} onClick={onRun} style={{ flex: 1 }}>
                查看字节码
              </Button>
              <Button icon={<DeleteOutlined />} onClick={onClear} />
            </div>
          </div>
        </Col>

        <Col xs={24} lg={14}>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">javap 结果</label>
            <CopyResultButton value={output} copied={copied} onCopy={onCopy} />
          </div>
          <div className="min-h-[420px] overflow-auto rounded-xl bg-gray-900 p-4">
            {decompiling ? (
              <div className="flex h-full min-h-[388px] items-center justify-center text-gray-400">
                <div className="text-center">
                  <FileTextOutlined style={{ fontSize: 52 }} />
                  <p className="mt-4">正在调用后端 javap...</p>
                </div>
              </div>
            ) : output ? (
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300">{output}</pre>
            ) : (
              <div className="flex h-full min-h-[388px] items-center justify-center text-gray-500">
                <div className="text-center">
                  <FileTextOutlined style={{ fontSize: 52 }} />
                  <p className="mt-4">字节码结果预览区域</p>
                  <p className="mt-2 text-xs">上传 .class 文件后，结果会显示在这里</p>
                </div>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
}

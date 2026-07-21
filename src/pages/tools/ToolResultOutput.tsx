import { CheckCircleOutlined, CopyOutlined } from "@ant-design/icons";
import { Button, Input } from "antd";
import { useId } from "react";

const { TextArea } = Input;

type CopyResultButtonProps = {
  value: string;
  copied: boolean;
  onCopy: () => void;
};

type ToolTextResultProps = CopyResultButtonProps & {
  label: string;
  rows: number;
  placeholder: string;
};

export function CopyResultButton({ value, copied, onCopy }: CopyResultButtonProps) {
  return (
    <Button type="text" disabled={!value} icon={copied ? <CheckCircleOutlined /> : <CopyOutlined />} onClick={onCopy} style={{ color: copied ? "#52c41a" : undefined }}>
      {copied ? "已复制" : "复制"}
    </Button>
  );
}

export function ToolTextResult({ label, value, copied, onCopy, rows, placeholder }: ToolTextResultProps) {
  const resultId = useId();

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={resultId} className="block text-sm font-medium text-gray-700">{label}</label>
        <CopyResultButton value={value} copied={copied} onCopy={onCopy} />
      </div>
      <TextArea id={resultId} rows={rows} readOnly value={value} placeholder={placeholder} className="bg-gray-50 font-mono" />
    </>
  );
}

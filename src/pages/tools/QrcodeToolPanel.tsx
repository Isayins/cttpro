import { useRef } from "react";
import { DeleteOutlined, QrcodeOutlined } from "@ant-design/icons";
import { Button, Col, Input, QRCode, Row, Slider } from "antd";

const { TextArea } = Input;

type QrcodeToolPanelProps = {
  input: string;
  size: number;
  value: string;
  onInputChange: (value: string) => void;
  onSizeChange: (value: number) => void;
  onGenerate: () => void;
  onClear: () => void;
};

export function QrcodeToolPanel({ input, size, value, onInputChange, onSizeChange, onGenerate, onClear }: QrcodeToolPanelProps) {
  const qrCodeRef = useRef<HTMLDivElement>(null);

  function downloadQrCode() {
    const canvas = qrCodeRef.current?.querySelector("canvas");
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `qrcode-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={9}>
        <label className="mb-2 block text-sm font-medium text-gray-700">二维码内容</label>
        <TextArea rows={6} value={input} onChange={(event) => onInputChange(event.target.value)} placeholder="输入链接、文本或任意内容" />
        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">尺寸：{size}px</label>
          <Slider min={100} max={320} value={size} onChange={(value) => onSizeChange(Number(value))} />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="primary" onClick={onGenerate} style={{ flex: 1 }}>
            生成二维码
          </Button>
          <Button icon={<DeleteOutlined />} onClick={onClear} />
        </div>
      </Col>
      <Col xs={24} lg={15}>
        <label className="mb-2 block text-sm font-medium text-gray-700">预览</label>
        <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-gray-100 bg-gray-50">
          {value ? (
            <div className="px-4 text-center">
              <div ref={qrCodeRef} className="inline-flex rounded-xl border border-gray-200 bg-white p-4">
                <QRCode value={value} size={size} color="#204cd6" bordered={false} type="canvas" />
              </div>
              <div className="mx-auto mt-3 max-w-xl break-all text-xs leading-5 text-gray-500">{value}</div>
              <Button className="mt-4" onClick={downloadQrCode}>
                下载 PNG
              </Button>
            </div>
          ) : (
            <div className="text-center text-gray-400">
              <QrcodeOutlined style={{ fontSize: 56 }} />
              <p className="mt-3">二维码预览区域</p>
            </div>
          )}
        </div>
      </Col>
    </Row>
  );
}

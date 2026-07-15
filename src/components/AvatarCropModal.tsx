import { useEffect, useState } from "react";
import {
  ReloadOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  ZoomInOutlined,
} from "@ant-design/icons";
import { Button, Modal, Slider, Space, Tooltip } from "antd";
import Cropper, { type Area, type Point } from "react-easy-crop";

import { createCroppedAvatarFile } from "../lib/avatarCrop";

type AvatarCropModalProps = {
  file: File | null;
  uploading: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => Promise<boolean>;
  onError: (error: unknown) => void;
};

const INITIAL_CROP: Point = { x: 0, y: 0 };

function normalizeRotation(value: number) {
  const normalized = value % 360;
  if (normalized > 180) return normalized - 360;
  if (normalized < -180) return normalized + 360;
  return normalized;
}

export default function AvatarCropModal({
  file,
  uploading,
  onCancel,
  onConfirm,
  onError,
}: AvatarCropModalProps) {
  const [imageSource, setImageSource] = useState("");
  const [crop, setCrop] = useState<Point>(INITIAL_CROP);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const busy = processing || uploading;

  useEffect(() => {
    if (!file) {
      setImageSource("");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setImageSource(objectUrl);
    setCrop(INITIAL_CROP);
    setZoom(1);
    setRotation(0);
    setCroppedArea(null);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  function resetCrop() {
    setCrop(INITIAL_CROP);
    setZoom(1);
    setRotation(0);
  }

  async function confirmCrop() {
    if (!file || !imageSource || !croppedArea || busy) {
      return;
    }

    setProcessing(true);
    try {
      const croppedFile = await createCroppedAvatarFile(
        imageSource,
        croppedArea,
        rotation,
        file.name,
      );
      const uploaded = await onConfirm(croppedFile);
      if (uploaded) {
        onCancel();
      }
    } catch (error) {
      onError(error);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Modal
      open={Boolean(file)}
      title="调整头像"
      width={620}
      centered
      destroyOnHidden
      closable={!busy}
      maskClosable={!busy}
      keyboard={!busy}
      onCancel={busy ? undefined : onCancel}
      afterOpenChange={setEditorReady}
      footer={[
        <Button key="cancel" disabled={busy} onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          loading={busy}
          disabled={!croppedArea}
          onClick={() => void confirmCrop()}
        >
          确认并上传
        </Button>,
      ]}
    >
      <div className="space-y-5">
        <div className="relative h-[clamp(280px,58vw,420px)] overflow-hidden rounded-lg bg-neutral-950">
          {editorReady && imageSource ? (
            <Cropper
              image={imageSource}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="round"
              showGrid
              objectFit="cover"
              minZoom={1}
              maxZoom={4}
              roundCropAreaPixels
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={(_, area) => setCroppedArea(area)}
              mediaProps={{ "aria-label": "待裁剪头像" }}
            />
          ) : null}
        </div>

        <div className="grid grid-cols-[24px_minmax(0,1fr)_44px] items-center gap-3">
          <ZoomInOutlined className="text-slate-500" />
          <Slider
            aria-label="头像缩放"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            disabled={busy}
            onChange={setZoom}
          />
          <span className="text-right text-xs tabular-nums text-slate-500">{zoom.toFixed(1)}x</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Space size="small">
            <Tooltip title="向左旋转 90 度">
              <Button
                aria-label="向左旋转 90 度"
                icon={<RotateLeftOutlined />}
                disabled={busy}
                onClick={() => setRotation((value) => normalizeRotation(value - 90))}
              />
            </Tooltip>
            <Tooltip title="向右旋转 90 度">
              <Button
                aria-label="向右旋转 90 度"
                icon={<RotateRightOutlined />}
                disabled={busy}
                onClick={() => setRotation((value) => normalizeRotation(value + 90))}
              />
            </Tooltip>
            <Tooltip title="重置选区">
              <Button
                aria-label="重置选区"
                icon={<ReloadOutlined />}
                disabled={busy}
                onClick={resetCrop}
              />
            </Tooltip>
          </Space>
          <span className="text-xs tabular-nums text-slate-500">旋转 {rotation}°</span>
        </div>
      </div>
    </Modal>
  );
}

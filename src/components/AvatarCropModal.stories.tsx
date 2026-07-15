import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "antd";

import "../index.css";
import AvatarCropModal from "./AvatarCropModal";

const sampleAvatar = `
  <svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
    <rect width="900" height="600" fill="#f4f7fb"/>
    <rect x="0" y="0" width="450" height="600" fill="#2a6df4"/>
    <circle cx="475" cy="245" r="155" fill="#f0b429"/>
    <rect x="330" y="390" width="360" height="130" rx="28" fill="#14213d"/>
    <text x="510" y="470" fill="white" font-size="64" font-family="Arial" text-anchor="middle">IDNCAR</text>
  </svg>
`;

function createSampleFile() {
  return new File([sampleAvatar], "sample-avatar.svg", { type: "image/svg+xml" });
}

function AvatarCropPreview() {
  const [file, setFile] = useState<File | null>(() => createSampleFile());
  const [resultUrl, setResultUrl] = useState("");

  useEffect(
    () => () => {
      if (resultUrl) {
        URL.revokeObjectURL(resultUrl);
      }
    },
    [resultUrl],
  );

  async function showCroppedAvatar(croppedFile: File) {
    setResultUrl(URL.createObjectURL(croppedFile));
    return true;
  }

  return (
    <div className="min-h-[640px] bg-slate-100 p-6">
      <Button type="primary" onClick={() => setFile(createSampleFile())}>
        打开头像裁剪
      </Button>
      {resultUrl ? (
        <img
          src={resultUrl}
          alt="裁剪结果"
          className="mt-6 h-32 w-32 rounded-full border-4 border-white object-cover shadow-sm"
        />
      ) : null}
      <AvatarCropModal
        file={file}
        uploading={false}
        onCancel={() => setFile(null)}
        onConfirm={showCroppedAvatar}
        onError={() => undefined}
      />
    </div>
  );
}

const meta = {
  title: "Profile/AvatarCropModal",
  component: AvatarCropModal,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof AvatarCropModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    file: null,
    uploading: false,
    onCancel: () => undefined,
    onConfirm: async () => false,
    onError: () => undefined,
  },
  render: () => <AvatarCropPreview />,
};

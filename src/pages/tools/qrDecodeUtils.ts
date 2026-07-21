import jsQR from "jsqr";

export const MAX_QR_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_QR_SOURCE_PIXELS = 16_000_000;
export const MAX_QR_DECODE_DIMENSION = 2_048;

export type QrDecodeResult = {
  content: string;
  width: number;
  height: number;
};

export async function decodeQrCodeFromFile(file: File): Promise<QrDecodeResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请上传图片文件");
  }
  if (file.size > MAX_QR_IMAGE_BYTES) {
    throw new Error("二维码图片不能超过 10 MB");
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    return await decodeQrCodeFromImageUrl(imageUrl);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function decodeQrCodeFromImageUrl(imageUrl: string): Promise<QrDecodeResult> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const sourceWidth = image.naturalWidth;
        const sourceHeight = image.naturalHeight;
        if (sourceWidth === 0 || sourceHeight === 0) {
          throw new Error("无法读取图片像素数据");
        }
        if (sourceWidth * sourceHeight > MAX_QR_SOURCE_PIXELS) {
          throw new Error("二维码图片分辨率过高，请压缩后重试");
        }

        const scale = Math.min(
          1,
          MAX_QR_DECODE_DIMENSION / Math.max(sourceWidth, sourceHeight),
        );
        const width = Math.max(1, Math.round(sourceWidth * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          throw new Error("无法读取图片像素数据");
        }

        context.drawImage(image, 0, 0, width, height);
        const imageData = context.getImageData(0, 0, width, height);
        const result = jsQR(imageData.data, width, height, {
          inversionAttempts: "attemptBoth",
        });

        if (!result?.data) {
          throw new Error("未识别到二维码，请确认图片清晰且二维码完整");
        }

        resolve({
          content: result.data,
          width: sourceWidth,
          height: sourceHeight,
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error("二维码解析失败"));
      }
    };
    image.onerror = () => reject(new Error("图片加载失败，请换一张图片试试"));
    image.src = imageUrl;
  });
}

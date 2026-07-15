import jsQR from "jsqr";

export type QrDecodeResult = {
  content: string;
  width: number;
  height: number;
};

export async function decodeQrCodeFromFile(file: File): Promise<QrDecodeResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请上传图片文件");
  }

  const imageUrl = await readFileAsDataUrl(file);
  return decodeQrCodeFromImageUrl(imageUrl);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("读取图片失败，请重新选择文件"));
    reader.readAsDataURL(file);
  });
}

function decodeQrCodeFromImageUrl(imageUrl: string): Promise<QrDecodeResult> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });

      if (!context || width === 0 || height === 0) {
        reject(new Error("无法读取图片像素数据"));
        return;
      }

      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);

      const imageData = context.getImageData(0, 0, width, height);
      const result = jsQR(imageData.data, width, height, {
        inversionAttempts: "attemptBoth",
      });

      if (!result?.data) {
        reject(new Error("未识别到二维码，请确认图片清晰且二维码完整"));
        return;
      }

      resolve({
        content: result.data,
        width,
        height,
      });
    };
    image.onerror = () => reject(new Error("图片加载失败，请换一张图片试试"));
    image.src = imageUrl;
  });
}

import type { Area } from "react-easy-crop";

const AVATAR_OUTPUT_SIZE = 512;
const AVATAR_JPEG_QUALITY = 0.9;

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function getRotatedBounds(width: number, height: number, rotation: number) {
  const radians = degreesToRadians(rotation);
  return {
    width: Math.abs(Math.cos(radians) * width) + Math.abs(Math.sin(radians) * height),
    height: Math.abs(Math.sin(radians) * width) + Math.abs(Math.cos(radians) * height),
  };
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法读取所选头像图片"));
    image.src = source;
  });
}

function canvasToAvatarFile(canvas: HTMLCanvasElement, originalName: string) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("头像裁剪失败，请重新选择图片"));
          return;
        }

        const baseName =
          originalName
            .replace(/\.[^.]+$/, "")
            .replace(/[^a-zA-Z0-9_-]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 48) || "avatar";
        resolve(
          new File([blob], `${baseName}-cropped.jpg`, {
            type: "image/jpeg",
            lastModified: Date.now(),
          }),
        );
      },
      "image/jpeg",
      AVATAR_JPEG_QUALITY,
    );
  });
}

export async function createCroppedAvatarFile(
  imageSource: string,
  crop: Area,
  rotation: number,
  originalName: string,
) {
  if (crop.width <= 0 || crop.height <= 0) {
    throw new Error("头像选区无效，请重新调整");
  }

  const image = await loadImage(imageSource);
  const bounds = getRotatedBounds(image.naturalWidth, image.naturalHeight, rotation);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("当前浏览器不支持头像裁剪");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const scaleX = AVATAR_OUTPUT_SIZE / crop.width;
  const scaleY = AVATAR_OUTPUT_SIZE / crop.height;
  context.scale(scaleX, scaleY);
  context.translate(-crop.x, -crop.y);
  context.translate(bounds.width / 2, bounds.height / 2);
  context.rotate(degreesToRadians(rotation));
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

  return canvasToAvatarFile(canvas, originalName);
}

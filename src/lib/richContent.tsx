import type { ReactNode, SyntheticEvent } from "react";

import { resolveAssetUrl } from "./media";

export const IMAGE_MARKUP_PATTERN = /^!\[图片]\(([^)]+)\)$/;
export const IMAGE_MAX_SIZE_BYTES = 8 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

const IMAGE_CONTENT_TYPES = new Set(["image/jpeg", "image/jpg", "image/pjpeg", "image/png", "image/webp", "image/gif"]);
const IMAGE_FILE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const SAFE_IMAGE_URL_PROTOCOLS = new Set(["http:", "https:"]);
const URL_WITHOUT_WHITESPACE_PATTERN = /^\S+$/;

export const CHAT_EMOJIS = [
  "😀",
  "😄",
  "😂",
  "😊",
  "😍",
  "😎",
  "🤔",
  "😭",
  "😤",
  "👍",
  "👏",
  "🙏",
  "🔥",
  "✨",
  "🎉",
  "💡",
  "✅",
  "❤️",
  "🚀",
  "🍵",
];

export const FORUM_EMOJIS = [
  "😀",
  "😄",
  "😂",
  "😊",
  "😍",
  "👍",
  "👏",
  "🙏",
  "🔥",
  "🎉",
  "💡",
  "✅",
  "❓",
  "🚗",
  "🛠️",
  "📌",
  "📷",
  "💬",
];

export function isAllowedImageFile(file: File) {
  const contentType = file.type.trim().toLowerCase();
  const name = file.name.trim().toLowerCase();
  return IMAGE_CONTENT_TYPES.has(contentType) || IMAGE_FILE_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export function getImageFileValidationError(file: File, label = "图片") {
  if (!isAllowedImageFile(file)) {
    return "仅支持 JPG、PNG、WEBP、GIF 图片";
  }
  if (file.size > IMAGE_MAX_SIZE_BYTES) {
    return `${label}不能超过 8MB`;
  }
  return null;
}

export function getClipboardImageFile(clipboardData?: DataTransfer | null) {
  if (!clipboardData) {
    return null;
  }

  const itemFile = Array.from(clipboardData.items)
    .filter((item) => item.kind === "file" && item.type.toLowerCase().startsWith("image/"))
    .map((item) => item.getAsFile())
    .find((file): file is File => Boolean(file));
  if (itemFile) {
    return itemFile;
  }

  return Array.from(clipboardData.files).find((file) => file.type.toLowerCase().startsWith("image/") || isAllowedImageFile(file)) ?? null;
}

export function buildImageMarkup(url: string) {
  return `![图片](${url})`;
}

export function getImageMarkupUrl(content: string, options: { trim?: boolean } = {}) {
  const target = options.trim ? content.trim() : content;
  const markupUrl = target.match(IMAGE_MARKUP_PATTERN)?.[1]?.trim();
  if (markupUrl) {
    return markupUrl;
  }

  return getBareImageLineUrl(target);
}

function isSafeLocalUploadPath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return (normalizedPath.startsWith("/uploads/") || normalizedPath.startsWith("/api/uploads/")) && !hasUnsafeLocalPathSegment(normalizedPath);
}

function hasUnsafeLocalPathSegment(path: string) {
  const [pathPart] = path.split(/[?#]/, 1);
  if (pathPart.includes("\\")) {
    return true;
  }

  const hasParentSegment = (value: string) => value.split("/").some((segment) => segment === "..");
  if (hasParentSegment(pathPart)) {
    return true;
  }

  try {
    return hasParentSegment(decodeURIComponent(pathPart));
  } catch {
    return true;
  }
}

function hasControlCharacter(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

export function isSafeImageUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed || hasControlCharacter(trimmed)) {
    return false;
  }

  if (trimmed.startsWith("//")) {
    return true;
  }
  if (isSafeLocalUploadPath(trimmed)) {
    return true;
  }

  try {
    return SAFE_IMAGE_URL_PROTOCOLS.has(new URL(trimmed).protocol);
  } catch {
    return false;
  }
}

function getImageUrlPathname(url: string) {
  const normalizedUrl = url.startsWith("//") ? `https:${url}` : url;
  try {
    return new URL(normalizedUrl, "https://local.invalid").pathname.toLowerCase();
  } catch {
    return "";
  }
}

function looksLikeImageUrl(url: string) {
  const pathname = getImageUrlPathname(url);
  return IMAGE_FILE_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}

function getBareImageLineUrl(content: string) {
  const target = content.trim();
  if (!target || !URL_WITHOUT_WHITESPACE_PATTERN.test(target)) {
    return null;
  }
  if (!isSafeImageUrl(target) || !looksLikeImageUrl(target)) {
    return null;
  }
  return target;
}

export function getTextPreviewWithoutImageBlocks(content: string, fallback = "[图片]") {
  return content
    .split(/\r?\n/)
    .filter((line) => {
      const imageUrl = getImageMarkupUrl(line, { trim: true });
      return !imageUrl || !isSafeImageUrl(imageUrl);
    })
    .join(" ")
    .trim() || fallback;
}

export function renderEmojiPanel(
  items: string[],
  onSelect: (emoji: string) => void,
  options: {
    wrapperClassName?: string;
    itemClassName?: string;
  } = {},
) {
  const wrapperClassName = options.wrapperClassName ?? "grid w-56 grid-cols-5 gap-1";
  const itemClassName = options.itemClassName ?? "flex h-9 w-9 items-center justify-center rounded-lg text-lg transition hover:bg-slate-100";

  return (
    <div className={wrapperClassName}>
      {items.map((emoji) => (
        <button key={emoji} type="button" onClick={() => onSelect(emoji)} className={itemClassName}>
          {emoji}
        </button>
      ))}
    </div>
  );
}

function showImageFallback(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  image.hidden = true;
  const fallback = image.nextElementSibling;
  if (fallback instanceof HTMLElement) {
    fallback.style.display = "inline-flex";
  }
}

export function renderImageMarkupLines(
  content: string,
  options: {
    alt: string;
    imageClassName: string;
    linkImages?: boolean;
    wrapperClassName?: string;
    textClassName?: string;
  },
): ReactNode {
  return (
    <div className={options.wrapperClassName ?? "space-y-2"}>
      {content.split(/\r?\n/).map((line, index) => {
        const imageUrl = getImageMarkupUrl(line, { trim: true });
        if (imageUrl && isSafeImageUrl(imageUrl)) {
          const resolvedImageUrl = resolveAssetUrl(imageUrl);
          if (!resolvedImageUrl) {
            return (
              <div key={`text-${index}`} className={options.textClassName ?? "whitespace-pre-wrap break-words"}>
                {line}
              </div>
            );
          }
          const image = (
            <span className="inline-block max-w-full">
              <img
                src={resolvedImageUrl}
                alt={options.alt}
                className={options.imageClassName}
                loading="lazy"
                onError={showImageFallback}
              />
              <span
                style={{ display: "none" }}
                className="max-w-full items-center rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              >
                图片加载失败
              </span>
            </span>
          );
          if (options.linkImages && resolvedImageUrl) {
            return (
              <a key={`${imageUrl}-${index}`} href={resolvedImageUrl} target="_blank" rel="noopener noreferrer" className="inline-block max-w-full">
                {image}
              </a>
            );
          }
          return <span key={`${imageUrl}-${index}`}>{image}</span>;
        }
        if (!line) {
          return <br key={`blank-${index}`} />;
        }
        return (
          <div key={`text-${index}`} className={options.textClassName ?? "whitespace-pre-wrap break-words"}>
            {line}
          </div>
        );
      })}
    </div>
  );
}


const HTTP_URL_PROTOCOLS = new Set(["http:", "https:"]);
const IMAGE_PATH_PREFIXES = ["/uploads/", "/api/uploads/", "/images/", "uploads/", "api/uploads/", "images/"];

function normalizeUrlValue(value?: string | null) {
  return value?.trim() ?? "";
}

function hasControlCharacter(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function isHttpUrl(value: string) {
  try {
    return HTTP_URL_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isProtocolRelativeUrl(value: string) {
  return /^\/\/[^\s/]/.test(value);
}

function hasUnsafePathSegment(value: string) {
  const [path] = value.split(/[?#]/, 1);
  return value.includes("\\") || path.split("/").some((segment) => segment === "..");
}

function isRelativePath(value: string) {
  if (hasUnsafePathSegment(value)) {
    return false;
  }
  return (value.startsWith("/") && !value.startsWith("//")) || /^[A-Za-z0-9_-][A-Za-z0-9._~/-]*(?:[?#].*)?$/.test(value);
}

export function isAllowedImageResourceUrl(value?: string | null) {
  const url = normalizeUrlValue(value);
  if (!url) {
    return true;
  }
  if (hasControlCharacter(url)) {
    return false;
  }
  if (isProtocolRelativeUrl(url) || isHttpUrl(url)) {
    return true;
  }
  return IMAGE_PATH_PREFIXES.some((prefix) => url.startsWith(prefix)) && isRelativePath(url);
}

export function isAllowedDownloadResourceUrl(value?: string | null) {
  const url = normalizeUrlValue(value);
  if (!url) {
    return false;
  }
  if (hasControlCharacter(url)) {
    return false;
  }
  return isProtocolRelativeUrl(url) || isHttpUrl(url) || isRelativePath(url);
}

export function isAllowedWebTargetUrl(value?: string | null) {
  const url = normalizeUrlValue(value);
  if (!url) {
    return true;
  }
  if (hasControlCharacter(url)) {
    return false;
  }
  return isHttpUrl(url) || (url.startsWith("/") && !url.startsWith("//"));
}

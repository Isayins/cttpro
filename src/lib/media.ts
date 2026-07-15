import { buildApiRequestUrl } from "../services/api/client";

function buildAssetUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return buildApiRequestUrl(normalizedPath);
}

export function resolveAssetUrl(url?: string | null) {
  if (!url) {
    return undefined;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^(?:https?:)?\/\//i.test(trimmed) || /^(data|blob):/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return buildAssetUrl(trimmed);
  }

  return buildAssetUrl(trimmed);
}

import { API_BASE_URL } from "../services/api";

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
    return `${API_BASE_URL}${trimmed}`;
  }

  return `${API_BASE_URL}/${trimmed}`;
}

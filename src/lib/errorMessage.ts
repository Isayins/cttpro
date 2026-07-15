export function getFriendlyMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  const text = error.message.trim();
  return /[\u4e00-\u9fa5]/.test(text) ? text : fallback;
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  return error.message.trim() || fallback;
}

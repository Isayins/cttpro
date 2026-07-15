let fallbackToken: string | null = null;

export const AUTH_SESSION_EXPIRED_EVENT = "idncar:auth-session-expired";

export interface AuthSessionExpiredDetail {
  status: number;
  message: string;
}

function getTokenStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function notifyAuthSessionExpired(detail: AuthSessionExpiredDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<AuthSessionExpiredDetail>(AUTH_SESSION_EXPIRED_EVENT, { detail }));
}

export function addAuthSessionExpiredListener(listener: (detail: AuthSessionExpiredDetail) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleSessionExpired = (event: Event) => {
    listener((event as CustomEvent<AuthSessionExpiredDetail>).detail);
  };

  window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
  return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
}

export function getAuthToken() {
  const storage = getTokenStorage();
  if (!storage) {
    return fallbackToken;
  }

  try {
    const storedToken = storage.getItem("token");
    fallbackToken = storedToken;
    return storedToken;
  } catch {
    return fallbackToken;
  }
}

export function setAuthToken(token: string) {
  fallbackToken = token;
  const storage = getTokenStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem("token", token);
  } catch {
    // Keep the token in memory when persistent storage is unavailable.
  }
}

export function clearAuthToken() {
  fallbackToken = null;
  const storage = getTokenStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem("token");
  } catch {
    // Storage cleanup should not block logout.
  }
}

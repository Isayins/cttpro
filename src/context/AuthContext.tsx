import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { message } from "antd";

import { addAuthSessionExpiredListener, clearAuthToken, getAuthToken, setAuthToken } from "../services/authToken";
import type { ChangePasswordPayload, LoginPayload, RegisterPayload, UpdateProfilePayload, User } from "../types/app";
import { AuthContext, type AuthContextValue } from "./auth-context";

const idleLogoutMinutes = Number(import.meta.env.VITE_IDLE_LOGOUT_MINUTES ?? 120);
const idleLogoutMs = Math.max(1, idleLogoutMinutes) * 60 * 1000;

async function loadAuthApi() {
  const { authApi } = await import("../services/api/auth");
  return authApi;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => getAuthToken());
  const [initializing, setInitializing] = useState(true);
  const idleTimerRef = useRef<number | null>(null);
  const lastSessionExpiredNoticeRef = useRef(0);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token || getAuthToken()) {
        const authApi = await loadAuthApi();
        await authApi.logout();
      }
    } catch {
      // Ignore logout network failures and clear local session anyway.
    } finally {
      clearIdleTimer();
      clearAuthToken();
      setToken(null);
      setUser(null);
    }
  }, [clearIdleTimer, token]);

  const resetIdleTimer = useCallback((activeToken = token) => {
    if (!activeToken && !getAuthToken()) {
      clearIdleTimer();
      return;
    }

    clearIdleTimer();
    idleTimerRef.current = window.setTimeout(() => {
      void logout();
      message.warning(`已连续 ${idleLogoutMinutes} 分钟无操作，系统已自动退出登录`);
    }, idleLogoutMs);
  }, [clearIdleTimer, logout, token]);

  const refreshFromStorage = useCallback(async () => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      setToken(null);
      setUser(null);
      setInitializing(false);
      return;
    }

    try {
      const authApi = await loadAuthApi();
      const currentUser = await authApi.me();
      setToken(currentToken);
      setUser(currentUser);
    } catch {
      clearAuthToken();
      setToken(null);
      setUser(null);
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    void refreshFromStorage();
  }, [refreshFromStorage]);

  useEffect(
    () =>
      addAuthSessionExpiredListener((detail) => {
        clearIdleTimer();
        setToken(null);
        setUser(null);

        const now = Date.now();
        if (now - lastSessionExpiredNoticeRef.current > 1500) {
          lastSessionExpiredNoticeRef.current = now;
          message.warning(detail.message || "登录已过期，请重新登录");
        }
      }),
    [clearIdleTimer],
  );

  useEffect(() => {
    if (!token || !user) {
      clearIdleTimer();
      return;
    }

    const handleActivity = () => resetIdleTimer();
    const events: Array<keyof WindowEventMap> = ["click", "keydown", "mousemove", "scroll", "touchstart"];

    resetIdleTimer();
    events.forEach((eventName) => window.addEventListener(eventName, handleActivity, { passive: true }));

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handleActivity));
      clearIdleTimer();
    };
  }, [clearIdleTimer, resetIdleTimer, token, user]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const authApi = await loadAuthApi();
      const response = await authApi.login(payload);
      setAuthToken(response.token);
      setToken(response.token);
      setUser(response.user);
      resetIdleTimer(response.token);
      return response.user;
    },
    [resetIdleTimer],
  );

  const register = useCallback(async (payload: RegisterPayload) => {
    const authApi = await loadAuthApi();
    return authApi.register(payload);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token && !getAuthToken()) {
      setUser(null);
      return null;
    }
    const authApi = await loadAuthApi();
    const currentUser = await authApi.me();
    setUser(currentUser);
    return currentUser;
  }, [token]);

  const updateProfile = useCallback(async (payload: UpdateProfilePayload) => {
    const authApi = await loadAuthApi();
    const currentUser = await authApi.updateProfile(payload);
    setUser(currentUser);
    return currentUser;
  }, []);

  const uploadAvatar = useCallback(async (file: File) => {
    const authApi = await loadAuthApi();
    const currentUser = await authApi.uploadAvatar(file);
    setUser(currentUser);
    return currentUser;
  }, []);

  const changePassword = useCallback(async (payload: ChangePasswordPayload) => {
    const authApi = await loadAuthApi();
    await authApi.changePassword(payload);
    clearIdleTimer();
    clearAuthToken();
    setToken(null);
    setUser(null);
  }, [clearIdleTimer]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      initializing,
      isAuthenticated: Boolean(user && token),
      isAdmin: user?.role === "ADMIN" || user?.role === "OWNER",
      isOwner: user?.role === "OWNER",
      login,
      register,
      logout,
      refreshUser,
      updateProfile,
      uploadAvatar,
      changePassword,
    }),
    [changePassword, initializing, login, logout, refreshUser, register, token, updateProfile, uploadAvatar, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

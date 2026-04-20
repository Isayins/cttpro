import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { message } from "antd";

import { authApi } from "../services/api";
import type { ChangePasswordPayload, LoginPayload, RegisterPayload, UpdateProfilePayload, User } from "../types/app";
import { AuthContext, type AuthContextValue } from "./auth-context";

const idleLogoutMinutes = Number(import.meta.env.VITE_IDLE_LOGOUT_MINUTES ?? 120);
const idleLogoutMs = Math.max(1, idleLogoutMinutes) * 60 * 1000;

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [initializing, setInitializing] = useState(true);
  const idleTimerRef = useRef<number | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (localStorage.getItem("token")) {
        await authApi.logout();
      }
    } catch {
      // Ignore logout network failures and clear local session anyway.
    } finally {
      clearIdleTimer();
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
    }
  }, [clearIdleTimer]);

  const resetIdleTimer = useCallback(() => {
    if (!localStorage.getItem("token")) {
      clearIdleTimer();
      return;
    }

    clearIdleTimer();
    idleTimerRef.current = window.setTimeout(() => {
      void logout();
      message.warning(`已连续 ${idleLogoutMinutes} 分钟无操作，系统已自动退出登录`);
    }, idleLogoutMs);
  }, [clearIdleTimer, logout]);

  const refreshFromStorage = useCallback(async () => {
    const currentToken = localStorage.getItem("token");
    if (!currentToken) {
      setToken(null);
      setUser(null);
      setInitializing(false);
      return;
    }

    try {
      const currentUser = await authApi.me();
      setToken(currentToken);
      setUser(currentUser);
    } catch {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    void refreshFromStorage();
  }, [refreshFromStorage]);

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
      const response = await authApi.login(payload);
      localStorage.setItem("token", response.token);
      setToken(response.token);
      setUser(response.user);
      resetIdleTimer();
      return response.user;
    },
    [resetIdleTimer],
  );

  const register = useCallback(async (payload: RegisterPayload) => {
    return authApi.register(payload);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem("token")) {
      setUser(null);
      return null;
    }
    const currentUser = await authApi.me();
    setUser(currentUser);
    return currentUser;
  }, []);

  const updateProfile = useCallback(async (payload: UpdateProfilePayload) => {
    const currentUser = await authApi.updateProfile(payload);
    setUser(currentUser);
    return currentUser;
  }, []);

  const uploadAvatar = useCallback(async (file: File) => {
    const currentUser = await authApi.uploadAvatar(file);
    setUser(currentUser);
    return currentUser;
  }, []);

  const changePassword = useCallback(async (payload: ChangePasswordPayload) => {
    await authApi.changePassword(payload);
  }, []);

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

import type {
  AuthResponse,
  ChangePasswordPayload,
  ChangeEmailPayload,
  EmailCodeResponse,
  LoginPayload,
  LoginRecord,
  RegisterPayload,
  ResetPasswordPayload,
  UpdateProfilePayload,
  User,
} from "../../types/app";
import { apiRequest } from "./client";

export const authApi = {
  login: (payload: LoginPayload) =>
    apiRequest<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: payload,
    }),
  sendEmailCode: (payload: { email: string }) =>
    apiRequest<EmailCodeResponse>("/api/auth/email-code", {
      method: "POST",
      body: payload,
    }),
  sendPasswordResetCode: (payload: { email: string }) =>
    apiRequest<EmailCodeResponse>("/api/auth/password-reset-code", {
      method: "POST",
      body: payload,
    }),
  resetPassword: (payload: ResetPasswordPayload) =>
    apiRequest<void>("/api/auth/reset-password", {
      method: "POST",
      body: payload,
    }),
  register: (payload: RegisterPayload) =>
    apiRequest<User>("/api/auth/register", {
      method: "POST",
      body: payload,
    }),
  me: () =>
    apiRequest<User>("/api/auth/me", {
      authMode: "required",
    }),
  updateProfile: (payload: UpdateProfilePayload) =>
    apiRequest<User>("/api/auth/me", {
      method: "PUT",
      authMode: "required",
      body: payload,
    }),
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<User>("/api/auth/avatar", {
      method: "POST",
      authMode: "required",
      body: formData,
      timeoutMs: 60_000,
    });
  },
  changePassword: (payload: ChangePasswordPayload) =>
    apiRequest<void>("/api/auth/change-password", {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  sendEmailChangeCode: (email: string) =>
    apiRequest<EmailCodeResponse>("/api/auth/email-change-code", {
      method: "POST",
      authMode: "required",
      body: { email },
    }),
  changeEmail: (payload: ChangeEmailPayload) =>
    apiRequest<void>("/api/auth/change-email", {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  getLoginRecords: (limit = 10) =>
    apiRequest<LoginRecord[]>(`/api/auth/login-records?limit=${limit}`, {
      authMode: "required",
    }),
  logout: () =>
    apiRequest<void>("/api/auth/logout", {
      method: "POST",
      authMode: "required",
    }),
};

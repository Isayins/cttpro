import type {
  AuthResponse,
  ChangePasswordPayload,
  EmailCodeResponse,
  LoginPayload,
  LoginRecord,
  RegisterPayload,
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
    });
  },
  changePassword: (payload: ChangePasswordPayload) =>
    apiRequest<void>("/api/auth/change-password", {
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

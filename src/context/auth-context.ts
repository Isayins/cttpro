import { createContext } from "react";

import type { ChangePasswordPayload, LoginPayload, RegisterPayload, UpdateProfilePayload, User } from "../types/app";

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  initializing: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<User>;
  uploadAvatar: (file: File) => Promise<User>;
  changePassword: (payload: ChangePasswordPayload) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

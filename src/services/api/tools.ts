import type {
  HotmailAccount,
  HotmailCodeResult,
  HotmailPasswordResult,
  ImportHotmailResponse,
  JavaDecompilePayload,
  JavaDecompileResult,
  ToolDiagnosticsResult,
  UpdateHotmailAccountMetadataPayload,
} from "../../types/app";
import { apiRequest } from "./client";

function getBrowserOrigin() {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

export const MAIL_CODE_PUBLIC_TOKEN_LENGTH = 32;
export const MAIL_CODE_PUBLIC_UID_LENGTH = 20;
export const MAIL_CODE_PUBLIC_TOKEN_PATTERN = new RegExp(`^[0-9a-f]{${MAIL_CODE_PUBLIC_TOKEN_LENGTH}}$`);
export const MAIL_CODE_PUBLIC_UID_PATTERN = new RegExp(`^[0-9a-f]{${MAIL_CODE_PUBLIC_UID_LENGTH}}$`);

function normalizeMailCodePublicLinkParts(token?: string | null, uid?: string | null) {
  const normalizedToken = token?.trim() ?? "";
  const normalizedUid = uid?.trim() ?? "";
  if (!MAIL_CODE_PUBLIC_TOKEN_PATTERN.test(normalizedToken) || !MAIL_CODE_PUBLIC_UID_PATTERN.test(normalizedUid)) {
    return null;
  }
  return { token: normalizedToken, uid: normalizedUid };
}

export function isMailCodePublicLinkReady(token?: string | null, uid?: string | null) {
  return normalizeMailCodePublicLinkParts(token, uid) !== null;
}

export function buildMailCodePublicUrl(token: string, uid?: string | null) {
  const linkParts = normalizeMailCodePublicLinkParts(token, uid);
  if (!linkParts) {
    return "";
  }

  const url = new URL("/code/fetch", getBrowserOrigin());
  url.searchParams.set("token", linkParts.token);
  url.searchParams.set("uid", linkParts.uid);
  return url.toString();
}

export function buildMailCodePublicApiUrl(token: string, uid?: string | null) {
  const linkParts = normalizeMailCodePublicLinkParts(token, uid);
  if (!linkParts) {
    return "";
  }

  const url = new URL("/api/code/fetch", getBrowserOrigin());
  url.searchParams.set("token", linkParts.token);
  url.searchParams.set("uid", linkParts.uid);
  return url.toString();
}

export const toolsApi = {
  getDiagnostics: () =>
    apiRequest<ToolDiagnosticsResult>("/api/tools/diagnostics", {
      authMode: "required",
      cache: "no-store",
    }),

  javaDecompile: (payload: JavaDecompilePayload) =>
    apiRequest<JavaDecompileResult>("/api/tools/java-decompile", {
      method: "POST",
      body: payload,
      authMode: "required",
    }),

  getHotmailAccounts: () =>
    apiRequest<HotmailAccount[]>("/api/tools/hotmail/accounts", {
      authMode: "required",
    }),

  updateHotmailAccountMetadata: (accountId: number, payload: UpdateHotmailAccountMetadataPayload) =>
    apiRequest<HotmailAccount>(`/api/tools/hotmail/accounts/${accountId}/metadata`, {
      method: "POST",
      body: payload,
      authMode: "required",
    }),

  updateHotmailAccountGroup: (accountIds: number[], groupName?: string | null) =>
    apiRequest<HotmailAccount[]>("/api/tools/hotmail/accounts/group", {
      method: "POST",
      body: { accountIds, groupName },
      authMode: "required",
    }),

  updateHotmailAccountRegistration: (
    accountIds: number[],
    payload: { gptRegistered?: boolean; grokRegistered?: boolean },
  ) =>
    apiRequest<HotmailAccount[]>("/api/tools/hotmail/accounts/registration", {
      method: "POST",
      body: { accountIds, ...payload },
      authMode: "required",
    }),

  importHotmailAccounts: (content: string, groupName?: string | null) =>
    apiRequest<ImportHotmailResponse>("/api/tools/hotmail/import", {
      method: "POST",
      body: { content, groupName },
      authMode: "required",
      timeoutMs: 60_000,
    }),

  deleteHotmailAccount: (accountId: number) =>
    apiRequest<{ message: string }>(`/api/tools/hotmail/accounts/${accountId}`, {
      method: "DELETE",
      authMode: "required",
    }),

  deleteHotmailAccounts: (accountIds: number[]) =>
    apiRequest<{ message: string; deleted: number }>("/api/tools/hotmail/accounts/batch-delete", {
      method: "POST",
      body: { accountIds },
      authMode: "required",
    }),

  getHotmailPassword: (accountId: number) =>
    apiRequest<HotmailPasswordResult>(`/api/tools/hotmail/accounts/${accountId}/password/reveal`, {
      method: "POST",
      authMode: "required",
      cache: "no-store",
    }),

  generateHotmailPublicLink: (accountId: number, targetEmail?: string | null) =>
    apiRequest<HotmailAccount>(`/api/tools/hotmail/accounts/${accountId}/public-link`, {
      method: "POST",
      body: targetEmail ? { targetEmail } : undefined,
      authMode: "required",
    }),

  disableHotmailPublicLink: (accountId: number) =>
    apiRequest<HotmailAccount>(`/api/tools/hotmail/accounts/${accountId}/public-link`, {
      method: "DELETE",
      authMode: "required",
    }),

  fetchHotmailCode: (accountId: number) =>
    apiRequest<HotmailCodeResult>(`/api/tools/hotmail/fetch/${accountId}`, {
      method: "POST",
      authMode: "required",
      timeoutMs: 90_000,
    }),

  fetchAllHotmailCodes: () =>
    apiRequest<HotmailCodeResult[]>("/api/tools/hotmail/fetch-all", {
      method: "POST",
      authMode: "required",
      timeoutMs: 300_000,
    }),

  fetchHotmailCodes: (accountIds: number[]) =>
    apiRequest<HotmailCodeResult[]>("/api/tools/hotmail/fetch-batch", {
      method: "POST",
      body: { accountIds },
      authMode: "required",
      timeoutMs: Math.max(90_000, Math.min(300_000, accountIds.length * 45_000)),
    }),

  checkHotmailAccount: (accountId: number) =>
    apiRequest<HotmailAccount>(`/api/tools/hotmail/check/${accountId}`, {
      method: "POST",
      authMode: "required",
      timeoutMs: 90_000,
    }),

  checkHotmailAccounts: (accountIds?: number[]) =>
    apiRequest<HotmailAccount[]>("/api/tools/hotmail/check", {
      method: "POST",
      body: accountIds ? { accountIds } : undefined,
      authMode: "required",
      timeoutMs: accountIds ? Math.max(90_000, Math.min(300_000, accountIds.length * 45_000)) : 300_000,
    }),
};

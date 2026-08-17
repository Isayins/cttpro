import {
  buildMailCodePublicApiUrl,
  isMailCodePublicLinkReady,
} from "../../services/api/tools";
import type {
  HotmailAccount,
  HotmailCodeResult,
  HotmailImportFailure,
} from "../../types/app";

export type GroupOption = { label: string; value: string };

export function parseSubEmails(value?: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(/\s+/)
    .map((email) => email.trim().toLowerCase())
    .filter((email, index, emails) => Boolean(email) && emails.indexOf(email) === index);
}

export function getPublicLinkTargets(account: HotmailAccount) {
  return Array.from(new Set([account.email.trim().toLowerCase(), ...parseSubEmails(account.subEmails)].filter(Boolean)));
}

export function formatPublicLinkPreview(token?: string | null, uid?: string | null) {
  if (!isMailCodePublicLinkReady(token, uid)) {
    return "";
  }
  const normalizedToken = (token ?? "").trim();
  const normalizedUid = (uid ?? "").trim();
  return `/code/fetch?token=${normalizedToken.slice(0, 8)}...${normalizedToken.slice(-6)}&uid=${normalizedUid.slice(0, 6)}...${normalizedUid.slice(-4)}`;
}

export function tokenCheckLabel(status?: string | null) {
  if (status === "OK") return "正常";
  if (status === "MISSING_IMAP") return "缺IMAP";
  if (status === "TOKEN_INVALID") return "Token失效";
  if (status === "CREDENTIAL_DECRYPT_FAILED") return "凭据解密失败";
  if (status === "SERVICE_ABUSE_MODE") return "微软风控";
  if (status === "PARTIAL_FAIL") return "部分异常";
  return "未自检";
}

export function tokenCheckColor(status?: string | null) {
  if (status === "OK") return "green";
  if (status === "MISSING_IMAP") return "orange";
  if (status === "TOKEN_INVALID") return "red";
  if (status === "CREDENTIAL_DECRYPT_FAILED") return "purple";
  if (status === "SERVICE_ABUSE_MODE") return "magenta";
  if (status === "PARTIAL_FAIL") return "volcano";
  return "default";
}

export function scopeTagColor(value?: boolean | null) {
  if (value === true) return "green";
  if (value === false) return "red";
  return "default";
}

export function toCachedResult(account: HotmailAccount): HotmailCodeResult | null {
  if (!account.lastCode) {
    return null;
  }
  return {
    accountId: account.id,
    email: account.email,
    code: account.lastCode,
    receivedTime: account.lastCodeTime ?? undefined,
    subject: account.lastSubject ?? undefined,
    sender: account.lastSender ?? undefined,
    source: account.lastSource ?? "缓存",
    folder: account.lastFolder ?? undefined,
    fetchTime: account.lastFetchTime ?? undefined,
    found: true,
  };
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function countNonEmptyLines(value: string) {
  return value.split(/\r?\n/).filter((line) => line.trim()).length;
}

export function formatImportFailureText(failures: HotmailImportFailure[]) {
  return failures
    .map((failure) => {
      const email = failure.email ? ` ${failure.email}` : "";
      return `第 ${failure.line} 行${email}：${failure.reason}`;
    })
    .join("\n");
}

export type RegistrationMarkValue = "KEEP" | "REGISTERED" | "UNREGISTERED";

export const registrationMarkOptions: { label: string; value: RegistrationMarkValue }[] = [
  { label: "不变", value: "KEEP" },
  { label: "标记已注册", value: "REGISTERED" },
  { label: "取消标记", value: "UNREGISTERED" },
];

export function registrationValueToBoolean(value: RegistrationMarkValue) {
  if (value === "REGISTERED") return true;
  if (value === "UNREGISTERED") return false;
  return undefined;
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function getActivePublicApiLink(account: HotmailAccount) {
  if (!account.publicCodeEnabled || !isMailCodePublicLinkReady(account.publicCodeToken, account.publicCodeUid)) {
    return "";
  }
  return buildMailCodePublicApiUrl(account.publicCodeToken ?? "", account.publicCodeUid);
}

export function compactTimestamp() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

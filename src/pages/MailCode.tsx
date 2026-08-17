import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Checkbox, Empty, Input, Modal, Popconfirm, Progress, Select, Spin, Table, Tag, Tooltip, message, type TableProps } from "antd";
import {
  CheckCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  EyeOutlined,
  FileAddOutlined,
  HistoryOutlined,
  LinkOutlined,
  MailOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
} from "@ant-design/icons";

import MainLayout from "../layouts/MainLayout";
import { getErrorMessage } from "../lib/errorMessage";
import { isAllowedWebTargetUrl } from "../lib/urlValidation";
import { adminApi } from "../services/api/admin";
import {
  buildMailCodePublicUrl,
  isMailCodePublicLinkReady,
  MAIL_CODE_PUBLIC_TOKEN_LENGTH,
  MAIL_CODE_PUBLIC_UID_LENGTH,
  toolsApi,
} from "../services/api/tools";
import type { HotmailAccount, HotmailCodeResult, HotmailImportFailure, HotmailPasswordResult, Product } from "../types/app";

const { TextArea } = Input;

import { EditableGroupSelect } from "./mailcode/EditableGroupSelect";
import { MailHistoryDrawer } from "./mailcode/MailHistoryDrawer";
import {
  compactTimestamp,
  countNonEmptyLines,
  downloadTextFile,
  formatDateTime,
  formatImportFailureText,
  formatPublicLinkPreview,
  getActivePublicApiLink,
  getPublicLinkTargets,
  parseSubEmails,
  registrationMarkOptions,
  registrationValueToBoolean,
  scopeTagColor,
  toCachedResult,
  tokenCheckColor,
  tokenCheckLabel,
} from "./mailcode/mailCodeHelpers";
import type { RegistrationMarkValue } from "./mailcode/mailCodeHelpers";
export default function MailCode() {
  const [accounts, setAccounts] = useState<HotmailAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importContent, setImportContent] = useState("");
  const [importGroupName, setImportGroupName] = useState("");
  const [importing, setImporting] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [clearingServiceAbuse, setClearingServiceAbuse] = useState(false);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [fetchingId, setFetchingId] = useState<number | null>(null);
  const [codeResults, setCodeResults] = useState<Map<number, HotmailCodeResult>>(new Map());
  const [latestResults, setLatestResults] = useState<HotmailCodeResult[]>([]);
  const [importFailures, setImportFailures] = useState<HotmailImportFailure[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [passwordLoadingId, setPasswordLoadingId] = useState<number | null>(null);
  const [passwordResult, setPasswordResult] = useState<HotmailPasswordResult | null>(null);
  const [metadataSavingId, setMetadataSavingId] = useState<number | null>(null);
  const [subEmailModalAccount, setSubEmailModalAccount] = useState<HotmailAccount | null>(null);
  const [subEmailContent, setSubEmailContent] = useState("");
  const [subEmailGptRegisteredEmails, setSubEmailGptRegisteredEmails] = useState<string[]>([]);
  const [subEmailGrokRegisteredEmails, setSubEmailGrokRegisteredEmails] = useState<string[]>([]);
  const [publicLinkLoadingId, setPublicLinkLoadingId] = useState<number | null>(null);
  const [publicLinkBatchGenerating, setPublicLinkBatchGenerating] = useState(false);
  const [publicLinkBatchProgress, setPublicLinkBatchProgress] = useState({ done: 0, total: 0 });
  const [publicLinkModalAccount, setPublicLinkModalAccount] = useState<HotmailAccount | null>(null);
  const [publicLinkTargetEmail, setPublicLinkTargetEmail] = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [tokenStatusFilter, setTokenStatusFilter] = useState("ALL");
  const [emailKeyword, setEmailKeyword] = useState("");
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [groupSaving, setGroupSaving] = useState(false);
  const [registrationModalOpen, setRegistrationModalOpen] = useState(false);
  const [registrationSaving, setRegistrationSaving] = useState(false);
  const [batchGptRegisteredValue, setBatchGptRegisteredValue] = useState<RegistrationMarkValue>("KEEP");
  const [batchGrokRegisteredValue, setBatchGrokRegisteredValue] = useState<RegistrationMarkValue>("KEEP");
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [mailHistoryAccount, setMailHistoryAccount] = useState<HotmailAccount | null>(null);
  const [cdkImportModalOpen, setCdkImportModalOpen] = useState(false);
  const [cdkProducts, setCdkProducts] = useState<Product[]>([]);
  const [cdkProductsLoading, setCdkProductsLoading] = useState(false);
  const [cdkProductId, setCdkProductId] = useState<number>();
  const [cdkImportNote, setCdkImportNote] = useState("邮箱取码链接");
  const [cdkImporting, setCdkImporting] = useState(false);
  const [cdkImportProgress, setCdkImportProgress] = useState({ done: 0, total: 0 });

  const selectedAccounts = useMemo(
    () => accounts.filter((account) => selectedAccountIds.includes(account.id)),
    [accounts, selectedAccountIds],
  );
  const groupOptions = useMemo(
    () =>
      Array.from(new Set(accounts.map((account) => account.groupName?.trim()).filter((groupName): groupName is string => Boolean(groupName))))
        .sort((a, b) => a.localeCompare(b, "zh-CN"))
        .map((groupName) => ({ label: groupName, value: groupName })),
    [accounts],
  );
  useEffect(() => {
    if (
      groupFilter !== "ALL" &&
      groupFilter !== "UNGROUPED" &&
      !groupOptions.some((option) => option.value === groupFilter)
    ) {
      setGroupFilter("ALL");
    }
  }, [groupFilter, groupOptions]);
  const filteredAccounts = useMemo(
    () =>
      accounts.filter((account) => {
        const normalizedEmailKeyword = emailKeyword.trim().toLowerCase();
        const accountGroup = account.groupName?.trim() || "";
        const groupMatched =
          groupFilter === "ALL" || (groupFilter === "UNGROUPED" ? !accountGroup : accountGroup === groupFilter);
        const tokenStatus = account.tokenCheckStatus || "UNKNOWN";
        const statusMatched = tokenStatusFilter === "ALL" || tokenStatus === tokenStatusFilter;
        const emailMatched =
          !normalizedEmailKeyword ||
          [account.email, account.subEmails, account.publicCodeTargetEmail]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedEmailKeyword));
        return groupMatched && statusMatched && emailMatched;
      }),
    [accounts, emailKeyword, groupFilter, tokenStatusFilter],
  );
  const missingPublicLinkAccounts = useMemo(
    () =>
      filteredAccounts.filter(
        (account) => !account.publicCodeEnabled || !isMailCodePublicLinkReady(account.publicCodeToken, account.publicCodeUid),
      ),
    [filteredAccounts],
  );
  const serviceAbuseAccounts = useMemo(
    () => accounts.filter((account) => account.tokenCheckStatus === "SERVICE_ABUSE_MODE"),
    [accounts],
  );
  const hasAccountFilters = emailKeyword.trim() !== "" || groupFilter !== "ALL" || tokenStatusFilter !== "ALL";
  const batchTargetAccounts = selectedAccounts.length > 0 ? selectedAccounts : hasAccountFilters ? filteredAccounts : accounts;
  const cdkProductOptions = useMemo(
    () =>
      cdkProducts
        .filter((product) => product.deliveryType === "CDK_EMAIL")
        .map((product) => ({
          label: `${product.title} / ${Number(product.price) === 0 ? "免费" : `¥${product.price}`} / 可发 ${product.deliveryCodeAvailableCount ?? 0}`,
          value: product.id,
        })),
    [cdkProducts],
  );
  const importLineCount = useMemo(() => countNonEmptyLines(importContent), [importContent]);
  const importCanSubmit = importLineCount > 0 && !importing;
  const importFailureText = useMemo(() => formatImportFailureText(importFailures), [importFailures]);

  const seedCachedResults = useCallback((data: HotmailAccount[]) => {
    const cachedMap = new Map<number, HotmailCodeResult>();
    data.forEach((account) => {
      const cached = toCachedResult(account);
      if (cached) {
        cachedMap.set(account.id, cached);
      }
    });
    setCodeResults(cachedMap);
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setShowSummary(false);
    setLatestResults([]);
    try {
      const data = await toolsApi.getHotmailAccounts();
      setAccounts(data);
      setSelectedAccountIds((prev) => prev.filter((accountId) => data.some((account) => account.id === accountId)));
      seedCachedResults(data);
    } catch (error) {
      message.error(getErrorMessage(error, "加载邮箱列表失败"));
    } finally {
      setLoading(false);
    }
  }, [seedCachedResults]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (!passwordResult) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPasswordResult(null);
      message.info("邮箱密码已自动隐藏");
    }, 120_000);

    return () => window.clearTimeout(timeoutId);
  }, [passwordResult]);

  const handleImportContentChange = useCallback((value: string) => {
    setImportContent(value);
    if (importFailures.length > 0) {
      setImportFailures([]);
    }
  }, [importFailures.length]);

  const updateAccountCache = useCallback((result: HotmailCodeResult) => {
    setAccounts((prev) =>
      prev.map((account) =>
        account.id === result.accountId
          ? result.found && result.code
            ? {
                ...account,
                lastCode: result.code ?? null,
                lastCodeTime: result.receivedTime ?? account.lastCodeTime ?? null,
                lastSubject: result.subject ?? null,
                lastSender: result.sender ?? null,
                lastSource: result.source ?? null,
                lastFolder: result.folder ?? null,
                lastError: null,
                lastFetchTime: result.fetchTime ?? new Date().toISOString(),
              }
            : {
                ...account,
                lastSource: result.source ?? account.lastSource ?? null,
                lastFolder: result.folder ?? account.lastFolder ?? null,
                lastError: result.error ?? (result.link || result.bodyPreview ? null : "最近邮件中未找到验证码"),
                lastFetchTime: result.fetchTime ?? new Date().toISOString(),
              }
          : account,
      ),
    );
  }, []);

  const handleImport = async () => {
    if (!importCanSubmit) {
      message.warning("请输入邮箱数据");
      return;
    }

    setImporting(true);
    try {
      const normalizedGroupName = importGroupName.trim();
      const result = await toolsApi.importHotmailAccounts(importContent, normalizedGroupName || undefined);
      setImportFailures(result.failures ?? []);
      const duplicateDetail =
        result.duplicateCount > 0
          ? `，重复 ${result.duplicateCount} 个（本批重复 ${result.batchDuplicateCount} 个，系统已有 ${result.existingDuplicateCount} 个；已有分组保持不变）`
          : "，未发现重复邮箱";
      if (result.skipped > 0) {
        message.warning(
          `导入完成，处理 ${result.imported} 个，跳过 ${result.skipped} 行${duplicateDetail}`,
        );
      } else {
        message.success(
          normalizedGroupName
            ? `导入完成，本次处理 ${result.imported} 个邮箱，已分组到 ${normalizedGroupName}${duplicateDetail}`
            : `导入完成，本次处理 ${result.imported} 个邮箱${duplicateDetail}`,
        );
        setImportModalOpen(false);
        setImportContent("");
        setImportGroupName("");
      }
      if (result.imported > 0) {
        void loadAccounts();
      }
    } catch (error) {
      message.error(getErrorMessage(error, "导入失败"));
    } finally {
      setImporting(false);
    }
  };

  const handleCopyImportFailures = useCallback(async () => {
    if (!importFailureText) {
      message.warning("暂无可复制的失败明细");
      return;
    }

    try {
      await navigator.clipboard.writeText(importFailureText);
      message.success("失败明细已复制");
    } catch {
      message.error("复制失败，请手动复制失败明细");
    }
  }, [importFailureText]);

  const removeAccountsFromState = useCallback((targetIds: number[]) => {
    const targetIdSet = new Set(targetIds);
    setLatestResults((prev) => prev.filter((item) => !targetIdSet.has(item.accountId)));
    setCodeResults((prev) => {
      const next = new Map(prev);
      targetIds.forEach((accountId) => next.delete(accountId));
      return next;
    });
    setAccounts((prev) => prev.filter((account) => !targetIdSet.has(account.id)));
    setSelectedAccountIds((prev) => prev.filter((accountId) => !targetIdSet.has(accountId)));
    setShowSummary(false);
  }, []);

  const handleDelete = useCallback(async (accountId: number) => {
    try {
      await toolsApi.deleteHotmailAccount(accountId);
      message.success("删除成功");
      removeAccountsFromState([accountId]);
    } catch (error) {
      message.error(getErrorMessage(error, "删除失败"));
    }
  }, [removeAccountsFromState]);

  const handleBatchDelete = useCallback(async () => {
    if (batchTargetAccounts.length === 0) {
      message.warning("当前没有可删除的邮箱");
      return;
    }

    const targetIds = batchTargetAccounts.map((account) => account.id);
    setBatchDeleting(true);
    try {
      const result = await toolsApi.deleteHotmailAccounts(targetIds);
      removeAccountsFromState(targetIds);
      message.success(`批量删除完成，已删除 ${result.deleted} 个邮箱`);
    } catch (error) {
      message.error(getErrorMessage(error, "批量删除失败"));
    } finally {
      setBatchDeleting(false);
    }
  }, [batchTargetAccounts, removeAccountsFromState]);

  const handleClearServiceAbuseAccounts = useCallback(async () => {
    if (serviceAbuseAccounts.length === 0) {
      message.warning("当前没有微软风控邮箱");
      return;
    }

    const targetIds = serviceAbuseAccounts.map((account) => account.id);
    setClearingServiceAbuse(true);
    try {
      const result = await toolsApi.deleteHotmailAccounts(targetIds);
      removeAccountsFromState(targetIds);
      message.success(`已清除 ${result.deleted} 个微软风控邮箱`);
    } catch (error) {
      message.error(getErrorMessage(error, "清除微软风控邮箱失败"));
    } finally {
      setClearingServiceAbuse(false);
    }
  }, [removeAccountsFromState, serviceAbuseAccounts]);

  const handleFetchCode = useCallback(async (accountId: number) => {
    setFetchingId(accountId);
    setShowSummary(true);
    try {
      const result = await toolsApi.fetchHotmailCode(accountId);
      setCodeResults((prev) => new Map(prev).set(accountId, result));
      setLatestResults([result]);
      updateAccountCache(result);
      if (result.found) {
        message.success(`获取验证码成功：${result.code}`);
      } else if (result.link) {
        message.info("未识别到验证码，已提取到验证链接");
      } else if (result.bodyPreview) {
        message.info("未识别到验证码，已提取邮件正文供人工查看");
      } else if (result.error) {
        message.error(result.error);
      } else {
        message.warning("最近邮件中未找到验证码");
      }
    } catch (error) {
      message.error(getErrorMessage(error, "获取验证码失败"));
    } finally {
      setFetchingId(null);
    }
  }, [updateAccountCache]);

  const handleFetchAll = async () => {
    if (accounts.length === 0) {
      message.warning("暂无邮箱账号");
      return;
    }
    if (batchTargetAccounts.length === 0) {
      message.warning("当前筛选结果为空");
      return;
    }

    setFetchingAll(true);
    setShowSummary(true);
    try {
      const selectedIds = selectedAccountIds.filter((accountId) => accounts.some((account) => account.id === accountId));
      const fetchingTargeted = selectedIds.length > 0 || hasAccountFilters;
      const targetIds = fetchingTargeted ? batchTargetAccounts.map((account) => account.id) : selectedIds;
      const results = fetchingTargeted ? await toolsApi.fetchHotmailCodes(targetIds) : await toolsApi.fetchAllHotmailCodes();
      setCodeResults((prev) => {
        const next = fetchingTargeted ? new Map(prev) : new Map<number, HotmailCodeResult>();
        results.forEach((result) => {
          next.set(result.accountId, result);
        });
        return next;
      });
      setLatestResults(results);
      results.forEach(updateAccountCache);
      const foundCount = results.filter((result) => result.found).length;
      const errorCount = results.filter((result) => !result.found && result.error).length;
      const targetText = selectedIds.length > 0 ? "选中邮箱" : hasAccountFilters ? "筛选邮箱" : "批量";
      message.success(
        `${targetText}获取完成，成功 ${foundCount} 个，失败 ${errorCount} 个，未找到 ${
          results.length - foundCount - errorCount
        } 个`,
      );
    } catch (error) {
      message.error(getErrorMessage(error, "批量获取失败"));
    } finally {
      setFetchingAll(false);
    }
  };

  const handleCopyCode = useCallback(async (code: string, accountId: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(accountId);
      setTimeout(() => setCopiedId(null), 1800);
      message.success("验证码已复制");
    } catch {
      message.error("复制失败");
    }
  }, []);

  const handleCopyText = useCallback(async (text: string, successMessage = "已复制") => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(successMessage);
    } catch {
      message.error("复制失败");
    }
  }, []);

  const handleViewPassword = useCallback(async (accountId: number) => {
    setPasswordLoadingId(accountId);
    try {
      const result = await toolsApi.getHotmailPassword(accountId);
      setPasswordResult(result);
    } catch (error) {
      message.error(getErrorMessage(error, "获取密码失败"));
    } finally {
      setPasswordLoadingId(null);
    }
  }, []);

  const handleCopyPassword = useCallback(async () => {
    if (!passwordResult?.password) {
      return;
    }

    try {
      await navigator.clipboard.writeText(passwordResult.password);
      message.success("邮箱密码已复制");
    } catch {
      message.error("复制失败");
    }
  }, [passwordResult]);

  const applyUpdatedAccount = useCallback((updatedAccount: HotmailAccount) => {
    setAccounts((prev) => prev.map((account) => (account.id === updatedAccount.id ? { ...account, ...updatedAccount } : account)));
  }, []);

  const applyUpdatedAccounts = useCallback((updatedAccounts: HotmailAccount[]) => {
    const updatedById = new Map(updatedAccounts.map((account) => [account.id, account]));
    setAccounts((prev) => prev.map((account) => (updatedById.has(account.id) ? { ...account, ...updatedById.get(account.id)! } : account)));
  }, []);

  const handleCopyPublicLink = useCallback(async (token?: string | null, uid?: string | null) => {
    if (!token) {
      message.warning("请先生成取码链接");
      return;
    }

    try {
      const publicUrl = buildMailCodePublicUrl(token, uid);
      if (!publicUrl) {
        message.warning("请重新生成新格式取码链接");
        return;
      }
      await navigator.clipboard.writeText(publicUrl);
      message.success("网页取码链接已复制");
    } catch {
      message.error("复制失败");
    }
  }, []);

  const handleOpenPublicLink = useCallback((token?: string | null, uid?: string | null) => {
    if (!token) {
      message.warning("请先生成取码链接");
      return;
    }

    const publicUrl = buildMailCodePublicUrl(token, uid);
    if (!publicUrl) {
      message.warning("请重新生成新格式取码链接");
      return;
    }
    window.open(publicUrl, "_blank", "noopener,noreferrer");
  }, []);

  const handleCopySelectedPublicLinks = useCallback(async () => {
    if (selectedAccounts.length === 0) {
      message.warning("请先勾选要复制链接的邮箱");
      return;
    }

    const links = selectedAccounts
      .map((account) => buildMailCodePublicUrl(account.publicCodeToken ?? "", account.publicCodeUid))
      .filter(Boolean);
    if (links.length === 0) {
      message.warning("所选邮箱还没有可复制的新格式取码链接");
      return;
    }

    try {
      await navigator.clipboard.writeText(links.join("\n"));
      const skippedCount = selectedAccounts.length - links.length;
      message.success(`已复制 ${links.length} 个取码链接${skippedCount > 0 ? `，跳过 ${skippedCount} 个未生成链接` : ""}`);
    } catch {
      message.error("复制失败");
    }
  }, [selectedAccounts]);

  const handleGenerateSelectedPublicLinks = useCallback(async () => {
    if (selectedAccounts.length === 0) {
      message.warning("请先勾选要生成链接的邮箱");
      return;
    }

    setPublicLinkBatchGenerating(true);
    setPublicLinkBatchProgress({ done: 0, total: selectedAccounts.length });
    const links: string[] = [];
    const failures: string[] = [];

    try {
      for (const account of selectedAccounts) {
        try {
          let token = account.publicCodeEnabled ? account.publicCodeToken : null;
          let uid = account.publicCodeEnabled ? account.publicCodeUid : null;

          if (!isMailCodePublicLinkReady(token, uid)) {
            const updatedAccount = await toolsApi.generateHotmailPublicLink(
              account.id,
              account.publicCodeTargetEmail || account.email,
            );
            applyUpdatedAccount(updatedAccount);
            token = updatedAccount.publicCodeToken;
            uid = updatedAccount.publicCodeUid;
          }

          const link = buildMailCodePublicUrl(token ?? "", uid);
          if (link) {
            links.push(link);
          } else {
            failures.push(account.email);
          }
        } catch {
          failures.push(account.email);
        } finally {
          setPublicLinkBatchProgress((current) => ({
            ...current,
            done: Math.min(current.done + 1, current.total),
          }));
        }
      }

      if (links.length === 0) {
        message.error("没有成功生成可复制的取码链接");
        return;
      }

      try {
        await navigator.clipboard.writeText(links.join("\n"));
        message.success(`已准备 ${links.length} 个网页取码链接并复制${failures.length > 0 ? `，${failures.length} 个失败` : ""}`);
      } catch {
        message.warning(`已准备 ${links.length} 个网页取码链接，但复制失败，请稍后重试复制所选链接`);
      }
    } finally {
      setPublicLinkBatchGenerating(false);
    }
  }, [applyUpdatedAccount, selectedAccounts]);

  const handleGeneratePublicLink = useCallback(
    async (account: HotmailAccount, targetEmail?: string | null) => {
      setPublicLinkLoadingId(account.id);
      try {
        const updatedAccount = await toolsApi.generateHotmailPublicLink(account.id, targetEmail || account.email);
        applyUpdatedAccount(updatedAccount);
        setPublicLinkModalAccount(null);
        setPublicLinkTargetEmail("");
        message.success("网页取码链接已生成并复制");
        if (updatedAccount.publicCodeToken) {
          void handleCopyPublicLink(updatedAccount.publicCodeToken, updatedAccount.publicCodeUid);
        }
      } catch (error) {
        message.error(getErrorMessage(error, "生成取码链接失败"));
      } finally {
        setPublicLinkLoadingId(null);
      }
    },
    [applyUpdatedAccount, handleCopyPublicLink],
  );

  const loadCdkProducts = useCallback(async () => {
    setCdkProductsLoading(true);
    try {
      const products = await adminApi.getProducts();
      setCdkProducts(products);
      const firstCdkProduct = products.find((product) => product.deliveryType === "CDK_EMAIL");
      setCdkProductId((current) => current ?? firstCdkProduct?.id);
    } catch (error) {
      message.error(getErrorMessage(error, "加载CDK商品失败"));
    } finally {
      setCdkProductsLoading(false);
    }
  }, []);

  const openCdkImportModal = useCallback(() => {
    if (selectedAccounts.length === 0) {
      message.warning("请先选择要导入的邮箱");
      return;
    }
    setCdkImportModalOpen(true);
    if (cdkProducts.length === 0) {
      void loadCdkProducts();
    }
  }, [cdkProducts.length, loadCdkProducts, selectedAccounts.length]);

  const handleGenerateLinksAndImportCdk = useCallback(async () => {
    if (selectedAccounts.length === 0) {
      message.warning("请先选择要导入的邮箱");
      return;
    }
    if (!cdkProductId) {
      message.warning("请选择要导入的CDK商品");
      return;
    }

    setCdkImporting(true);
    setCdkImportProgress({ done: 0, total: selectedAccounts.length });
    const links: string[] = [];
    const failures: string[] = [];

    try {
      for (const account of selectedAccounts) {
        try {
          let token = account.publicCodeEnabled ? account.publicCodeToken : null;
          let uid = account.publicCodeEnabled ? account.publicCodeUid : null;
          if (!isMailCodePublicLinkReady(token, uid)) {
            const updatedAccount = await toolsApi.generateHotmailPublicLink(
              account.id,
              account.publicCodeTargetEmail || account.email,
            );
            applyUpdatedAccount(updatedAccount);
            token = updatedAccount.publicCodeToken;
            uid = updatedAccount.publicCodeUid;
          }
          const publicUrl = token ? buildMailCodePublicUrl(token, uid) : "";
          if (publicUrl) {
            links.push(publicUrl);
          } else {
            failures.push(account.email);
          }
        } catch {
          failures.push(account.email);
        } finally {
          setCdkImportProgress((current) => ({
            ...current,
            done: Math.min(current.done + 1, current.total),
          }));
        }
      }

      if (links.length === 0) {
        message.error("没有成功生成可导入的取码链接");
        return;
      }

      const result = await adminApi.importProductDeliveryCodes({
        productId: cdkProductId,
        content: links.join("\n"),
        note: cdkImportNote.trim() || "邮箱取码链接",
      });
      const resultText = `CDK导入完成，新增 ${result.importedCount} 个，跳过 ${result.skippedCount} 个`;
      if (failures.length > 0) {
        message.warning(`${resultText}，${failures.length} 个邮箱链接生成失败`);
      } else {
        message.success(resultText);
      }
      setCdkImportModalOpen(false);
    } catch (error) {
      message.error(getErrorMessage(error, "导入CDK失败"));
    } finally {
      setCdkImporting(false);
    }
  }, [applyUpdatedAccount, cdkImportNote, cdkProductId, selectedAccounts]);

  const openPublicLinkModal = useCallback(
    (account: HotmailAccount) => {
      const targets = getPublicLinkTargets(account);
      if (targets.length <= 1) {
        void handleGeneratePublicLink(account, targets[0] ?? account.email);
        return;
      }
      setPublicLinkModalAccount(account);
      setPublicLinkTargetEmail(account.publicCodeTargetEmail || targets[0] || account.email);
    },
    [handleGeneratePublicLink],
  );

  const handleDisablePublicLink = useCallback(
    async (account: HotmailAccount) => {
      setPublicLinkLoadingId(account.id);
      try {
        const updatedAccount = await toolsApi.disableHotmailPublicLink(account.id);
        applyUpdatedAccount(updatedAccount);
        message.success("取码链接已停用");
      } catch (error) {
        message.error(getErrorMessage(error, "停用取码链接失败"));
      } finally {
        setPublicLinkLoadingId(null);
      }
    },
    [applyUpdatedAccount],
  );

  const handleToggleRegistration = useCallback(
    async (account: HotmailAccount, field: "gptRegistered" | "grokRegistered", checked: boolean) => {
      const label = field === "gptRegistered" ? "GPT" : "Grok";
      setMetadataSavingId(account.id);
      try {
        const updatedAccount = await toolsApi.updateHotmailAccountMetadata(
          account.id,
          field === "gptRegistered" ? { gptRegistered: checked } : { grokRegistered: checked },
        );
        applyUpdatedAccount(updatedAccount);
        message.success(checked ? `已标记为 ${label} 已注册` : `已取消 ${label} 注册标记`);
      } catch (error) {
        message.error(getErrorMessage(error, `保存 ${label} 状态失败`));
      } finally {
        setMetadataSavingId(null);
      }
    },
    [applyUpdatedAccount],
  );

  const handleExportMailLinks = useCallback(() => {
    if (batchTargetAccounts.length === 0) {
      message.warning("当前没有可导出的邮箱");
      return;
    }

    const content = batchTargetAccounts
      .map((account) => `${account.email}----${getActivePublicApiLink(account)}`)
      .join("\r\n");
    const missingLinkCount = batchTargetAccounts.filter((account) => !getActivePublicApiLink(account)).length;
    downloadTextFile(`hotmail-code-links-${compactTimestamp()}.txt`, content);
    message.success(
      missingLinkCount > 0
        ? `已导出 ${batchTargetAccounts.length} 个邮箱，其中 ${missingLinkCount} 个还没有可用取码链接`
        : `已导出 ${batchTargetAccounts.length} 个邮箱和取码链接`,
    );
  }, [batchTargetAccounts]);

  const openRegistrationModal = useCallback(() => {
    if (batchTargetAccounts.length === 0) {
      message.warning("当前没有可标记的邮箱");
      return;
    }
    setBatchGptRegisteredValue("KEEP");
    setBatchGrokRegisteredValue("KEEP");
    setRegistrationModalOpen(true);
  }, [batchTargetAccounts]);

  const handleSaveRegistration = useCallback(async () => {
    const gptRegistered = registrationValueToBoolean(batchGptRegisteredValue);
    const grokRegistered = registrationValueToBoolean(batchGrokRegisteredValue);
    if (gptRegistered === undefined && grokRegistered === undefined) {
      message.warning("请选择要更新的注册标记");
      return;
    }
    if (batchTargetAccounts.length === 0) {
      message.warning("当前没有可标记的邮箱");
      return;
    }

    setRegistrationSaving(true);
    try {
      const updatedAccounts = await toolsApi.updateHotmailAccountRegistration(
        batchTargetAccounts.map((account) => account.id),
        { gptRegistered, grokRegistered },
      );
      applyUpdatedAccounts(updatedAccounts);
      setRegistrationModalOpen(false);
      message.success(`已更新 ${updatedAccounts.length} 个邮箱的注册标记`);
    } catch (error) {
      message.error(getErrorMessage(error, "批量标记失败"));
    } finally {
      setRegistrationSaving(false);
    }
  }, [applyUpdatedAccounts, batchGptRegisteredValue, batchGrokRegisteredValue, batchTargetAccounts]);

  const openSubEmailModal = useCallback((account: HotmailAccount) => {
    setSubEmailModalAccount(account);
    setSubEmailContent(account.subEmails ?? "");
    setSubEmailGptRegisteredEmails(parseSubEmails(account.gptRegisteredSubEmails));
    setSubEmailGrokRegisteredEmails(parseSubEmails(account.grokRegisteredSubEmails));
  }, []);

  const handleSaveSubEmails = useCallback(async () => {
    if (!subEmailModalAccount) {
      return;
    }

    setMetadataSavingId(subEmailModalAccount.id);
    try {
      const currentSubEmails = parseSubEmails(subEmailContent);
      const gptRegisteredSubEmails = subEmailGptRegisteredEmails.filter((email) => currentSubEmails.includes(email));
      const grokRegisteredSubEmails = subEmailGrokRegisteredEmails.filter((email) => currentSubEmails.includes(email));
      const updatedAccount = await toolsApi.updateHotmailAccountMetadata(subEmailModalAccount.id, {
        subEmails: subEmailContent,
        gptRegisteredSubEmails: gptRegisteredSubEmails.join("\n"),
        grokRegisteredSubEmails: grokRegisteredSubEmails.join("\n"),
      });
      applyUpdatedAccount(updatedAccount);
      setSubEmailModalAccount(null);
      setSubEmailContent("");
      setSubEmailGptRegisteredEmails([]);
      setSubEmailGrokRegisteredEmails([]);
      message.success("子邮箱已保存");
    } catch (error) {
      message.error(getErrorMessage(error, "保存子邮箱失败"));
    } finally {
      setMetadataSavingId(null);
    }
  }, [applyUpdatedAccount, subEmailContent, subEmailGptRegisteredEmails, subEmailGrokRegisteredEmails, subEmailModalAccount]);

  const openGroupModal = useCallback(() => {
    if (selectedAccounts.length === 0) {
      message.warning("请先选择要分组的邮箱");
      return;
    }
    const firstGroup = selectedAccounts[0]?.groupName ?? "";
    const sameGroup = selectedAccounts.every((account) => (account.groupName ?? "") === firstGroup);
    setGroupNameInput(sameGroup ? firstGroup : "");
    setGroupModalOpen(true);
  }, [selectedAccounts]);

  const handleSaveGroup = useCallback(async () => {
    if (selectedAccounts.length === 0) {
      message.warning("请先选择要分组的邮箱");
      return;
    }

    setGroupSaving(true);
    try {
      const updatedAccounts = await toolsApi.updateHotmailAccountGroup(
        selectedAccounts.map((account) => account.id),
        groupNameInput,
      );
      applyUpdatedAccounts(updatedAccounts);
      setGroupModalOpen(false);
      message.success(groupNameInput.trim() ? `已分组到 ${groupNameInput.trim()}` : "已移出分组");
    } catch (error) {
      message.error(getErrorMessage(error, "保存分组失败"));
    } finally {
      setGroupSaving(false);
    }
  }, [applyUpdatedAccounts, groupNameInput, selectedAccounts]);

  const handleCheckAccount = useCallback(
    async (accountId: number) => {
      setCheckingId(accountId);
      try {
        const updatedAccount = await toolsApi.checkHotmailAccount(accountId);
        applyUpdatedAccount(updatedAccount);
        message.success(`自检完成：${tokenCheckLabel(updatedAccount.tokenCheckStatus)}`);
      } catch (error) {
        message.error(getErrorMessage(error, "自检失败"));
      } finally {
        setCheckingId(null);
      }
    },
    [applyUpdatedAccount],
  );

  const handleCheckAccounts = useCallback(async () => {
    if (accounts.length === 0) {
      message.warning("暂无邮箱账号");
      return;
    }
    if (batchTargetAccounts.length === 0) {
      message.warning("当前筛选结果为空");
      return;
    }

    const selectedIds = selectedAccounts.map((account) => account.id);
    setCheckingAll(true);
    try {
      const targetIds = selectedIds.length > 0 || hasAccountFilters ? batchTargetAccounts.map((account) => account.id) : undefined;
      const updatedAccounts = await toolsApi.checkHotmailAccounts(targetIds);
      applyUpdatedAccounts(updatedAccounts);
      const okCount = updatedAccounts.filter((account) => account.tokenCheckStatus === "OK").length;
      const missingImapCount = updatedAccounts.filter((account) => account.tokenCheckStatus === "MISSING_IMAP").length;
      const invalidCount = updatedAccounts.filter((account) => account.tokenCheckStatus === "TOKEN_INVALID").length;
      const credentialDecryptCount = updatedAccounts.filter((account) => account.tokenCheckStatus === "CREDENTIAL_DECRYPT_FAILED").length;
      const serviceAbuseCount = updatedAccounts.filter((account) => account.tokenCheckStatus === "SERVICE_ABUSE_MODE").length;
      message.success(
        `自检完成：正常 ${okCount} 个，缺IMAP ${missingImapCount} 个，Token失效 ${invalidCount} 个，凭据解密失败 ${credentialDecryptCount} 个，微软风控 ${serviceAbuseCount} 个，其它 ${
          updatedAccounts.length - okCount - missingImapCount - invalidCount - credentialDecryptCount - serviceAbuseCount
        } 个`,
      );
    } catch (error) {
      message.error(getErrorMessage(error, "批量自检失败"));
    } finally {
      setCheckingAll(false);
    }
  }, [accounts.length, applyUpdatedAccounts, batchTargetAccounts, hasAccountFilters, selectedAccounts]);

  const columns: TableProps<HotmailAccount>["columns"] = useMemo(
    () => [
      {
        title: "邮箱 / 标记",
        dataIndex: "email",
        key: "email",
        width: 360,
        render: (email: string, record: HotmailAccount) => (
          <div className="space-y-2">
            {(() => {
              const subEmails = parseSubEmails(record.subEmails);
              const gptRegisteredSubEmails = parseSubEmails(record.gptRegisteredSubEmails);
              const grokRegisteredSubEmails = parseSubEmails(record.grokRegisteredSubEmails);
              return (
                <>
                  <div className="flex items-center gap-2">
                    <MailOutlined className="text-blue-500" />
                    <span className="font-medium text-slate-800">{email}</span>
                  </div>
                  {subEmails.length > 0 ? (
                    <div className="flex max-w-[320px] flex-wrap gap-1">
                      {subEmails.slice(0, 2).map((subEmail) => {
                        const gptRegistered = gptRegisteredSubEmails.includes(subEmail);
                        const grokRegistered = grokRegisteredSubEmails.includes(subEmail);
                        const marks = [gptRegistered ? "GPT" : "", grokRegistered ? "Grok" : ""].filter(Boolean).join("/");
                        return (
                          <Tag key={subEmail} color={marks ? "green" : "blue"}>
                            {subEmail}
                            {marks ? ` ${marks}` : ""}
                          </Tag>
                        );
                      })}
                      {subEmails.length > 2 ? <Tag>+{subEmails.length - 2}</Tag> : null}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-1">
                    {record.groupName ? <Tag color="purple">{record.groupName}</Tag> : <Tag>未分组</Tag>}
                    <Checkbox
                      checked={record.gptRegistered}
                      disabled={metadataSavingId === record.id}
                      onChange={(event) => void handleToggleRegistration(record, "gptRegistered", event.target.checked)}
                    >
                      GPT
                    </Checkbox>
                    <Checkbox
                      checked={record.grokRegistered}
                      disabled={metadataSavingId === record.id}
                      onChange={(event) => void handleToggleRegistration(record, "grokRegistered", event.target.checked)}
                    >
                      Grok
                    </Checkbox>
                    {record.passwordSaved ? <Tag color="cyan">密码</Tag> : <Tag>无密码</Tag>}
                  </div>
                </>
              );
            })()}
          </div>
        ),
      },
      {
        title: "分组 / 自检",
        key: "tokenCheck",
        width: 260,
        render: (_: unknown, record: HotmailAccount) => (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1">
              {record.groupName ? <Tag color="purple">{record.groupName}</Tag> : <Tag>未分组</Tag>}
              <Tag color={tokenCheckColor(record.tokenCheckStatus)}>{tokenCheckLabel(record.tokenCheckStatus)}</Tag>
            </div>
            <div className="flex flex-wrap gap-1">
              <Tag color={scopeTagColor(record.graphTokenOk)}>Graph</Tag>
              <Tag color={scopeTagColor(record.outlookTokenOk)}>Outlook</Tag>
              <Tag color={scopeTagColor(record.imapTokenOk)}>IMAP</Tag>
            </div>
            {record.tokenCheckedAt ? <div className="text-xs text-slate-400">自检：{formatDateTime(record.tokenCheckedAt)}</div> : null}
            {record.tokenCheckSummary && record.tokenCheckStatus !== "OK" ? (
              <div className="max-w-[230px] truncate text-xs text-red-500" title={record.tokenCheckSummary}>
                {record.tokenCheckSummary}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        title: "最新验证码",
        key: "code",
        width: 260,
        render: (_: unknown, record: HotmailAccount) => {
          const liveResult = codeResults.get(record.id);
          const cachedResult = toCachedResult(record);
          const displayResult = liveResult?.found ? liveResult : cachedResult;
          const cachedError = record.lastError && (!liveResult || liveResult.fetchTime === record.lastFetchTime) ? record.lastError : null;

          if (liveResult && !liveResult.found && liveResult.error) {
            return (
              <div className="space-y-1">
                <Tag color="error">获取失败</Tag>
                <div className="max-w-[230px] truncate text-xs text-red-500" title={liveResult.error}>
                  {liveResult.error}
                </div>
              </div>
            );
          }

          if (liveResult && !liveResult.found && (liveResult.link || liveResult.bodyPreview)) {
            return (
              <div className="max-w-[240px] space-y-1">
                <Tag color="warning">未识别到验证码</Tag>
                {liveResult.link ? (
                  <div className="flex items-center gap-1">
                    {isAllowedWebTargetUrl(liveResult.link) ? (
                      <a
                        href={liveResult.link}
                        target="_blank"
                        rel="noreferrer"
                        className="max-w-[190px] truncate text-xs text-blue-500"
                        title={liveResult.link}
                      >
                        验证链接：{liveResult.link}
                      </a>
                    ) : (
                      <span
                        className="max-w-[190px] truncate text-xs text-slate-500"
                        title={liveResult.link}
                      >
                        验证链接：{liveResult.link}
                      </span>
                    )}
                    <Tooltip title="复制链接">
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => void handleCopyText(liveResult.link!, "已复制验证链接")}
                      />
                    </Tooltip>
                  </div>
                ) : null}
                {liveResult.bodyPreview ? (
                  <div className="max-h-24 max-w-[230px] overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-500">
                    正文：{liveResult.bodyPreview}
                  </div>
                ) : null}
                {liveResult.receivedTime ? (
                  <div className="text-xs text-slate-400">时间：{formatDateTime(liveResult.receivedTime)}</div>
                ) : null}
              </div>
            );
          }

          if (!displayResult?.code) {
            return (
              <div className="space-y-1">
                <span className="text-slate-400">未获取</span>
                {cachedError ? (
                  <div className="max-w-[230px] truncate text-xs text-red-500" title={cachedError}>
                    上次失败：{cachedError}
                  </div>
                ) : null}
              </div>
            );
          }

          return (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Tag color="success" className="px-3 py-1 font-mono text-base">
                  {displayResult.code}
                </Tag>
                <Tooltip title="复制验证码">
                  <Button
                    type="text"
                    size="small"
                    icon={copiedId === record.id ? <CheckCircleOutlined className="text-green-500" /> : <CopyOutlined />}
                    onClick={() => void handleCopyCode(displayResult.code!, record.id)}
                  />
                </Tooltip>
                {!liveResult?.found && cachedResult?.code ? <Tag>上次保存</Tag> : null}
              </div>
              {displayResult.receivedTime ? (
                <div className="text-xs text-slate-400">时间：{formatDateTime(displayResult.receivedTime)}</div>
              ) : null}
              {displayResult.source || displayResult.folder ? (
                <div className="text-xs text-slate-400">
                  来源：{[displayResult.source, displayResult.folder].filter(Boolean).join(" / ")}
                </div>
              ) : null}
              {cachedError ? (
                <div className="max-w-[230px] truncate text-xs text-red-500" title={cachedError}>
                  上次失败：{cachedError}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        title: "取码链接",
        key: "publicLink",
        width: 290,
        render: (_: unknown, record: HotmailAccount) => {
          const active = Boolean(record.publicCodeEnabled && isMailCodePublicLinkReady(record.publicCodeToken, record.publicCodeUid));
          const legacyActive = Boolean(record.publicCodeEnabled && record.publicCodeToken && !active);
          const publicUrl = active && record.publicCodeToken ? buildMailCodePublicUrl(record.publicCodeToken, record.publicCodeUid) : "";
          const publicUrlPreview = active ? formatPublicLinkPreview(record.publicCodeToken, record.publicCodeUid) : "";

          return (
            <div className="space-y-2">
              {active ? (
                <>
                  <div className="flex items-center gap-2">
                    <Tag color="geekblue">已启用</Tag>
                    <span className="max-w-[180px] truncate text-xs text-slate-500" title={record.publicCodeTargetEmail || record.email}>
                      {record.publicCodeTargetEmail || record.email}
                    </span>
                  </div>
                  <div className="max-w-[250px] truncate font-mono text-xs text-slate-400" title={publicUrl}>
                    {publicUrlPreview}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Tooltip title="复制取码链接">
                      <Button size="small" icon={<CopyOutlined />} onClick={() => void handleCopyPublicLink(record.publicCodeToken, record.publicCodeUid)} />
                    </Tooltip>
                    <Tooltip title="打开取码链接">
                      <Button size="small" icon={<ExportOutlined />} onClick={() => handleOpenPublicLink(record.publicCodeToken, record.publicCodeUid)} />
                    </Tooltip>
                    <Tooltip title="重新生成取码链接">
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        loading={publicLinkLoadingId === record.id}
                        onClick={() => openPublicLinkModal(record)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title="确定停用这个取码链接吗？"
                      onConfirm={() => void handleDisablePublicLink(record)}
                      okText="停用"
                      cancelText="取消"
                    >
                      <Tooltip title="停用取码链接">
                        <Button size="small" danger icon={<StopOutlined />} loading={publicLinkLoadingId === record.id} />
                      </Tooltip>
                    </Popconfirm>
                  </div>
                  <div className="space-y-0.5 text-xs text-slate-400">
                    <div>网页端取码，可重复打开</div>
                    {record.publicCodeCreatedAt ? <div>生成：{formatDateTime(record.publicCodeCreatedAt)}</div> : null}
                    {record.publicCodeLastAccessTime ? <div>访问：{formatDateTime(record.publicCodeLastAccessTime)}</div> : null}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  {legacyActive ? (
                    <div className="space-y-1">
                      <Tag color="orange">旧格式</Tag>
                      <div className="text-xs text-slate-400">请重新生成新格式链接</div>
                    </div>
                  ) : (
                    <span className="text-slate-400">未生成</span>
                  )}
                  <div className="flex flex-wrap items-center gap-1">
                    <Button
                      size="small"
                      icon={<LinkOutlined />}
                      loading={publicLinkLoadingId === record.id}
                      onClick={() => openPublicLinkModal(record)}
                    >
                      {legacyActive ? "重新生成" : "生成"}
                    </Button>
                    {legacyActive ? (
                      <Popconfirm
                        title="确定停用这个旧取码链接吗？"
                        onConfirm={() => void handleDisablePublicLink(record)}
                        okText="停用"
                        cancelText="取消"
                      >
                        <Button size="small" danger icon={<StopOutlined />} loading={publicLinkLoadingId === record.id} />
                      </Popconfirm>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          );
        },
      },
      {
        title: "邮件主题 / 状态",
        key: "subject",
        width: 280,
        render: (_: unknown, record: HotmailAccount) => {
          const result = codeResults.get(record.id) ?? toCachedResult(record);
          if (!result?.subject) {
            return result?.folder || result?.source || record.lastFetchTime ? (
              <div className="space-y-1 text-xs text-slate-400">
                {result?.folder || result?.source ? <div>{[result.source, result.folder].filter(Boolean).join(" / ")}</div> : null}
                {record.lastFetchTime ? <div>检查：{formatDateTime(record.lastFetchTime)}</div> : null}
              </div>
            ) : (
              <span className="text-slate-400">-</span>
            );
          }
          return (
            <div className="space-y-1">
              <div className="max-w-[260px] truncate text-slate-600" title={result.subject}>
                {result.subject}
              </div>
              {result.source || result.folder ? (
                <div className="text-xs text-slate-400">{[result.source, result.folder].filter(Boolean).join(" / ")}</div>
              ) : null}
              {record.lastFetchTime ? <div className="text-xs text-slate-400">检查：{formatDateTime(record.lastFetchTime)}</div> : null}
            </div>
          );
        },
      },
      {
        title: "操作",
        key: "actions",
        width: 205,
        render: (_: unknown, record: HotmailAccount) => (
          <div className="flex items-center gap-1">
            <Tooltip title="获取验证码">
              <Button
                type="primary"
                size="small"
                icon={<SearchOutlined />}
                loading={fetchingId === record.id}
                onClick={() => void handleFetchCode(record.id)}
              />
            </Tooltip>
            <Tooltip title="历史邮件">
              <Button size="small" icon={<HistoryOutlined />} onClick={() => setMailHistoryAccount(record)} />
            </Tooltip>
            <Tooltip title="查看密码">
              <Button
                size="small"
                icon={<EyeOutlined />}
                loading={passwordLoadingId === record.id}
                disabled={!record.passwordSaved}
                onClick={() => void handleViewPassword(record.id)}
              />
            </Tooltip>
            <Tooltip title="维护子邮箱">
              <Button
                size="small"
                icon={<EditOutlined />}
                loading={metadataSavingId === record.id}
                onClick={() => openSubEmailModal(record)}
              />
            </Tooltip>
            <Tooltip title="自检授权">
              <Button
                size="small"
                icon={<CheckCircleOutlined />}
                loading={checkingId === record.id}
                onClick={() => void handleCheckAccount(record.id)}
              />
            </Tooltip>
            <Popconfirm
              title="确定删除这个邮箱吗？"
              onConfirm={() => void handleDelete(record.id)}
              okText="删除"
              cancelText="取消"
            >
              <Tooltip title="删除">
                <Button type="text" danger size="small" icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </div>
        ),
      },
    ],
    [
      codeResults,
      copiedId,
      checkingId,
      handleCheckAccount,
      fetchingId,
      handleCopyCode,
      handleCopyText,
      handleCopyPublicLink,
      handleDelete,
      handleDisablePublicLink,
      handleFetchCode,
      handleOpenPublicLink,
      handleToggleRegistration,
      handleViewPassword,
      metadataSavingId,
      openSubEmailModal,
      openPublicLinkModal,
      passwordLoadingId,
      publicLinkLoadingId,
    ],
  );

  const summaryResults = latestResults;
  const visibleSummaryResults = useMemo(() => summaryResults.slice(0, 120), [summaryResults]);
  const batchTargetText = selectedAccounts.length > 0 ? `选中 ${selectedAccounts.length} 个` : hasAccountFilters ? `当前筛选 ${filteredAccounts.length} 个` : `全部 ${accounts.length} 个`;
  const batchTargetDescription =
    selectedAccounts.length > 0
      ? "批量获取、自检、标记、导出、删除和导入CDK只会处理已勾选邮箱。"
      : hasAccountFilters
        ? "未勾选邮箱时，批量获取、自检、标记、导出和删除会处理当前筛选结果。"
        : "未勾选且未筛选时，批量获取、自检、标记、导出和删除会处理全部邮箱。";
  const clearAccountFilters = useCallback(() => {
    setEmailKeyword("");
    setGroupFilter("ALL");
    setTokenStatusFilter("ALL");
  }, []);
  const selectFilteredAccounts = useCallback(() => {
    if (filteredAccounts.length === 0) {
      message.warning("当前筛选结果为空");
      return;
    }

    setSelectedAccountIds(filteredAccounts.map((account) => account.id));
    message.success(`已选择筛选结果 ${filteredAccounts.length} 个邮箱`);
  }, [filteredAccounts]);
  const selectMissingPublicLinkAccounts = useCallback(() => {
    if (missingPublicLinkAccounts.length === 0) {
      message.warning("当前范围内没有缺少新格式取码链接的邮箱");
      return;
    }

    setSelectedAccountIds(missingPublicLinkAccounts.map((account) => account.id));
    message.success(`已选择 ${missingPublicLinkAccounts.length} 个缺少取码链接的邮箱`);
  }, [missingPublicLinkAccounts]);
  const openImportModal = useCallback(() => {
    setImportFailures([]);
    setImportGroupName(groupFilter !== "ALL" && groupFilter !== "UNGROUPED" ? groupFilter : "");
    setImportModalOpen(true);
  }, [groupFilter]);
  const publicLinkTargetOptions = useMemo(
    () =>
      publicLinkModalAccount
        ? getPublicLinkTargets(publicLinkModalAccount).map((email) => ({
            label: email,
            value: email,
          }))
        : [],
    [publicLinkModalAccount],
  );

  return (
    <MainLayout contentWidth="wide">
      <div className="py-8">
        <div className="space-y-6">
          <section className="rounded-[30px] border border-white/75 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(238,247,255,0.96))] p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)] md:p-8">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">邮箱接码工具</div>
                <h1 className="mt-3 text-3xl font-semibold text-slate-900 md:text-4xl">Hotmail 邮箱接码</h1>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  支持批量导入 Hotmail/Outlook 邮箱，登录后按用户隔离保存，并直接回显上次抓到的验证码。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Tag color="blue">邮箱 {accounts.length}</Tag>
                {hasAccountFilters ? <Tag color="purple">筛选 {filteredAccounts.length}</Tag> : null}
                <Tag color="green">已缓存 {accounts.filter((account) => account.lastCode).length}</Tag>
                <Tag color="geekblue">
                  取码链接 {accounts.filter((account) => account.publicCodeEnabled && isMailCodePublicLinkReady(account.publicCodeToken, account.publicCodeUid)).length}
                </Tag>
                {missingPublicLinkAccounts.length > 0 ? <Tag color="orange">缺链接 {missingPublicLinkAccounts.length}</Tag> : null}
                {serviceAbuseAccounts.length > 0 ? <Tag color="magenta">微软风控 {serviceAbuseAccounts.length}</Tag> : null}
                {selectedAccountIds.length > 0 ? <Tag color="gold">已选 {selectedAccountIds.length}</Tag> : null}
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="primary"
              icon={<FileAddOutlined />}
              onClick={openImportModal}
            >
              导入邮箱
            </Button>
            <Button icon={<ReloadOutlined />} loading={fetchingAll} onClick={() => void handleFetchAll()} disabled={accounts.length === 0 || batchTargetAccounts.length === 0}>
              {`获取${batchTargetText}`}
            </Button>
            <Button icon={<CheckCircleOutlined />} loading={checkingAll} onClick={() => void handleCheckAccounts()} disabled={accounts.length === 0 || batchTargetAccounts.length === 0}>
              {`自检${batchTargetText}`}
            </Button>
            <Button icon={<EditOutlined />} disabled={selectedAccounts.length === 0} onClick={openGroupModal}>
              新建/设置分组
            </Button>
            <Button icon={<CheckCircleOutlined />} disabled={batchTargetAccounts.length === 0} onClick={openRegistrationModal}>
              批量标记
            </Button>
            <Popconfirm
              title={`确定删除${batchTargetText}邮箱吗？`}
              description="删除后对应的取码链接、缓存验证码和备注都会一起移除。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => void handleBatchDelete()}
            >
              <Button danger icon={<DeleteOutlined />} loading={batchDeleting} disabled={batchTargetAccounts.length === 0}>
                {`删除${batchTargetText}`}
              </Button>
            </Popconfirm>
            <Popconfirm
              title={`确定清除 ${serviceAbuseAccounts.length} 个微软风控邮箱吗？`}
              description="只会永久删除自检状态为“微软风控”的邮箱及其取码链接、缓存验证码和备注。"
              okText="清除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => void handleClearServiceAbuseAccounts()}
            >
              <Button
                danger
                icon={<StopOutlined />}
                loading={clearingServiceAbuse}
                disabled={serviceAbuseAccounts.length === 0}
              >
                一键清除微软风控{serviceAbuseAccounts.length > 0 ? `（${serviceAbuseAccounts.length}）` : ""}
              </Button>
            </Popconfirm>
            <Button
              icon={<LinkOutlined />}
              loading={cdkImporting}
              disabled={selectedAccounts.length === 0}
              onClick={openCdkImportModal}
            >
              生成链接并导入CDK
            </Button>
            <Button
              icon={<LinkOutlined />}
              loading={publicLinkBatchGenerating}
              disabled={selectedAccounts.length === 0 || cdkImporting}
              onClick={() => void handleGenerateSelectedPublicLinks()}
            >
              生成/补齐所选链接
            </Button>
            <Button icon={<CopyOutlined />} disabled={selectedAccounts.length === 0 || publicLinkBatchGenerating} onClick={() => void handleCopySelectedPublicLinks()}>
              复制所选链接
            </Button>
            <Button icon={<ExportOutlined />} disabled={batchTargetAccounts.length === 0} onClick={handleExportMailLinks}>
              导出邮箱链接
            </Button>
            {selectedAccountIds.length > 0 ? <Button onClick={() => setSelectedAccountIds([])}>取消选择</Button> : null}
            <Button icon={<ReloadOutlined />} onClick={() => void loadAccounts()} loading={loading}>
              刷新列表
            </Button>
            <Input.Search
              allowClear
              enterButton
              placeholder="筛选邮箱/子邮箱"
              value={emailKeyword}
              onChange={(event) => setEmailKeyword(event.target.value)}
              style={{ width: 240 }}
            />
            <Select
              value={groupFilter}
              onChange={setGroupFilter}
              style={{ width: 150 }}
              options={[
                { label: "全部分组", value: "ALL" },
                { label: "未分组", value: "UNGROUPED" },
                ...groupOptions,
              ]}
            />
            <Select
              value={tokenStatusFilter}
              onChange={setTokenStatusFilter}
              style={{ width: 150 }}
              options={[
                { label: "全部状态", value: "ALL" },
                { label: "未自检", value: "UNKNOWN" },
                { label: "正常", value: "OK" },
                { label: "缺IMAP", value: "MISSING_IMAP" },
                { label: "Token失效", value: "TOKEN_INVALID" },
                { label: "凭据解密失败", value: "CREDENTIAL_DECRYPT_FAILED" },
                { label: "微软风控", value: "SERVICE_ABUSE_MODE" },
                { label: "部分异常", value: "PARTIAL_FAIL" },
              ]}
            />
            {hasAccountFilters ? (
              <>
                <Button onClick={selectFilteredAccounts} disabled={filteredAccounts.length === 0}>
                  选择筛选结果
                </Button>
                <Button onClick={clearAccountFilters}>清空筛选</Button>
              </>
            ) : null}
            <Button onClick={selectMissingPublicLinkAccounts} disabled={missingPublicLinkAccounts.length === 0 || publicLinkBatchGenerating}>
              选择缺链接
            </Button>
          </div>

          {accounts.length > 0 ? (
            <Alert
              showIcon
              type={selectedAccounts.length > 0 ? "info" : "warning"}
              message={`批量操作范围：${batchTargetText}邮箱`}
              description={batchTargetDescription}
            />
          ) : null}

          {publicLinkBatchGenerating ? (
            <Alert
              showIcon
              type="info"
              message={`正在生成/补齐所选取码链接 ${publicLinkBatchProgress.done}/${publicLinkBatchProgress.total}`}
              description={
                <Progress
                  percent={
                    publicLinkBatchProgress.total > 0
                      ? Math.round((publicLinkBatchProgress.done / publicLinkBatchProgress.total) * 100)
                      : 0
                  }
                  size="small"
                />
              }
            />
          ) : null}

          {showSummary && summaryResults.length > 0 ? (
            <Alert
              type="info"
              showIcon
              message="验证码获取结果"
              description={
                <div className="mt-2 max-h-80 space-y-1 overflow-auto pr-2">
                  {visibleSummaryResults.map((result) => (
                    <div key={result.accountId} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-slate-600">{result.email}：</span>
                      {result.found && result.code ? (
                        <Tag color="success" className="font-mono">
                          {result.code}
                        </Tag>
                      ) : result.link || result.bodyPreview ? (
                        <Tag color="warning">仅链接/正文</Tag>
                      ) : result.error ? (
                        <Tag color="error">失败</Tag>
                      ) : (
                        <Tag color="warning">未找到</Tag>
                      )}
                      {result.source || result.folder ? <span className="text-xs text-slate-400">{[result.source, result.folder].filter(Boolean).join(" / ")}</span> : null}
                      {!result.found && result.link ? (
                        isAllowedWebTargetUrl(result.link) ? (
                          <a
                            href={result.link}
                            target="_blank"
                            rel="noreferrer"
                            className="max-w-[420px] truncate text-xs text-blue-500"
                            title={result.link}
                          >
                            {result.link}
                          </a>
                        ) : (
                          <span className="max-w-[420px] truncate text-xs text-slate-500" title={result.link}>
                            {result.link}
                          </span>
                        )
                      ) : null}
                      {!result.found && result.bodyPreview ? (
                        <span className="max-h-24 max-w-[520px] overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-500">
                          {result.bodyPreview}
                        </span>
                      ) : null}
                      {result.error ? (
                        <span className="max-w-[520px] truncate text-xs text-red-500" title={result.error}>
                          {result.error}
                        </span>
                      ) : null}
                    </div>
                  ))}
                  {summaryResults.length > visibleSummaryResults.length ? (
                    <div className="text-xs text-slate-400">还有 {summaryResults.length - visibleSummaryResults.length} 条结果未展开显示</div>
                  ) : null}
                </div>
              }
            />
          ) : null}

          <div className="rounded-[24px] border border-white/75 bg-white/95 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <Spin size="large" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div className="text-center">
                      <p className="text-slate-500">暂无邮箱账号</p>
                      <p className="mt-1 text-xs text-slate-400">点击“导入邮箱”后即可开始管理自己的 Hotmail 账号</p>
                    </div>
                  }
                />
              </div>
            ) : (
              <Table
                dataSource={filteredAccounts}
                columns={columns}
                rowKey="id"
                className="p-4"
                rowSelection={{
                  selectedRowKeys: selectedAccountIds,
                  onChange: (keys) => setSelectedAccountIds(keys.map((key) => Number(key))),
                  preserveSelectedRowKeys: true,
                }}
                scroll={{ x: 1170 }}
                pagination={{
                  pageSize: 30,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 个邮箱`,
                }}
                locale={{ emptyText: hasAccountFilters ? "当前筛选没有匹配邮箱，可清空筛选后重试" : "暂无邮箱账号" }}
              />
            )}
          </div>

          <div className="rounded-[20px] border border-slate-100 bg-slate-50 p-5">
            <div className="text-sm font-medium text-slate-700">使用说明</div>
            <div className="mt-3 space-y-2 text-sm leading-7 text-slate-500">
              <div>
                1. 导入格式：每行一个邮箱，格式为
                <code className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-xs">邮箱----密码----client_id----refresh_token</code>
                <span className="ml-1">或</span>
                <code className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-xs">邮箱----client_id----refresh_token</code>
              </div>
              <div>2. 新导入数据会自动按当前登录用户隔离保存；四段格式中的邮箱密码会加密保存，可在单个账号上查看。</div>
              <div>3. 生成 refresh_token 时需授权 Mail.Read、IMAP.AccessAsUser.All 和 offline_access；旧 token 缺权限时请重新授权后导入。</div>
              <div>4. 一个主邮箱下有子邮箱/别名时，在该行点击“子邮箱”维护；收码仍使用主邮箱的 Graph、Outlook REST 和 IMAP OAuth。</div>
              <div>5. 导入时可选择已有分组或填写新名字；新名字会自动生成分组，重复导入同一邮箱也会同步到这个分组。</div>
              <div>6. 勾选邮箱后可批量设置分组、注册标记、导出邮箱链接、删除、获取验证码和自检授权；未勾选时批量操作会作用于当前筛选结果或全部邮箱。</div>
              <div>7. 主邮箱可在列表直接勾选 GPT/Grok 已注册；子邮箱可在“子邮箱”弹窗里逐个勾选。</div>
              <div>8. 页面会优先显示这次抓取结果；如果这次未找到，也会保留上次已保存的验证码方便继续查看。</div>
              <div>
                9. 新格式取码链接会打开网页端
                <code className="mx-1 rounded bg-slate-200 px-1.5 py-0.5 text-xs">
                  /code/fetch?token={MAIL_CODE_PUBLIC_TOKEN_LENGTH}位小写hex&amp;uid={MAIL_CODE_PUBLIC_UID_LENGTH}位小写hex
                </code>
                ；网页会自动调用
                <code className="mx-1 rounded bg-slate-200 px-1.5 py-0.5 text-xs">/api/code/fetch</code>
                获取 JSON。链接不是一次性，只有停用或重新生成后旧链接才会失效。
              </div>
              <div>10. 自检识别到微软返回 service_abuse_mode 时会标记为“微软风控”；“一键清除微软风控”只删除这类邮箱，并会在删除前再次确认。</div>
              <div>11. 点击单个邮箱的“历史邮件”按钮可分页浏览邮件摘要，并按需加载纯文本正文。</div>
            </div>
          </div>
        </div>
      </div>

      <MailHistoryDrawer
        account={mailHistoryAccount}
        open={mailHistoryAccount !== null}
        onClose={() => setMailHistoryAccount(null)}
      />

      <Modal
        title="设置邮箱分组"
        open={groupModalOpen}
        onCancel={() => setGroupModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setGroupModalOpen(false)}>
            取消
          </Button>,
          <Button key="save" type="primary" loading={groupSaving} onClick={() => void handleSaveGroup()}>
            保存分组
          </Button>,
        ]}
        width={520}
      >
        <div className="space-y-4">
          <Alert type="info" showIcon message={`将设置选中的 ${selectedAccounts.length} 个邮箱`} description="选择已有分组或输入新名称；清空后保存会把这些邮箱移出分组。" />
          <div className="space-y-2">
            <div className="text-xs text-slate-400">分组名称</div>
            <EditableGroupSelect
              options={groupOptions}
              value={groupNameInput}
              onChange={setGroupNameInput}
              placeholder="选择已有分组或输入新分组"
            />
          </div>
        </div>
      </Modal>

      <Modal
        title="批量注册标记"
        open={registrationModalOpen}
        onCancel={() => {
          if (!registrationSaving) {
            setRegistrationModalOpen(false);
          }
        }}
        footer={[
          <Button key="cancel" disabled={registrationSaving} onClick={() => setRegistrationModalOpen(false)}>
            取消
          </Button>,
          <Button key="save" type="primary" loading={registrationSaving} onClick={() => void handleSaveRegistration()}>
            保存标记
          </Button>,
        ]}
        width={520}
      >
        <div className="space-y-4">
          <Alert type="info" showIcon message={`将更新${batchTargetText}邮箱`} description="选择“不变”的平台不会被修改；可同时设置 GPT 和 Grok。" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs text-slate-400">GPT</div>
              <Select className="w-full" value={batchGptRegisteredValue} options={registrationMarkOptions} onChange={setBatchGptRegisteredValue} />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-400">Grok</div>
              <Select className="w-full" value={batchGrokRegisteredValue} options={registrationMarkOptions} onChange={setBatchGrokRegisteredValue} />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title="导入 Hotmail 邮箱"
        open={importModalOpen}
        onCancel={() => {
          setImportModalOpen(false);
          setImportContent("");
          setImportGroupName("");
          setImportFailures([]);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setImportModalOpen(false);
              setImportContent("");
              setImportGroupName("");
              setImportFailures([]);
            }}
          >
            取消
          </Button>,
          <Button key="import" type="primary" loading={importing} disabled={!importCanSubmit} onClick={() => void handleImport()}>
            导入
          </Button>,
        ]}
        width={680}
      >
        <div className="space-y-4">
          <Alert
            type="info"
            showIcon
            message="导入格式说明"
            description={
              <div className="mt-1 text-xs leading-6">
                每行一个邮箱账号，格式如下：
                <br />
                <code className="rounded bg-slate-100 px-1">邮箱----密码----client_id----refresh_token</code>
                <br />
                <code className="rounded bg-slate-100 px-1">邮箱----client_id----refresh_token</code>
                <br />
                <code className="rounded bg-slate-100 px-1">邮箱----密码----client_id----refresh_token----0</code>
                <br />
                <code className="rounded bg-slate-100 px-1">邮箱----密码----client_id----邮箱----密码----client_id----refresh_token----0</code>
                <br />
                <span className="text-slate-500">refresh_token 需要包含 Mail.Read、IMAP.AccessAsUser.All 和 offline_access 权限。</span>
              </div>
            }
          />
          <div className="space-y-2">
            <div className="text-xs text-slate-400">默认分组</div>
            <EditableGroupSelect
              options={groupOptions}
              value={importGroupName}
              onChange={setImportGroupName}
              placeholder="选择已有分组或输入新分组"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Tag color={importLineCount > 0 ? "blue" : "default"} className="m-0">待导入 {importLineCount} 行</Tag>
            {importGroupName.trim() ? <Tag color="green" className="m-0">默认分组：{importGroupName.trim()}</Tag> : null}
            {importFailures.length > 0 ? <Tag color="orange" className="m-0">失败 {importFailures.length} 行</Tag> : null}
          </div>
          <TextArea
            rows={10}
            value={importContent}
            onChange={(event) => handleImportContentChange(event.target.value)}
            placeholder="example@hotmail.com----password----client_id----refresh_token----0"
            className="font-mono text-xs"
          />
          {importFailures.length > 0 ? (
            <Alert
              type="warning"
              showIcon
              message={`有 ${importFailures.length} 行未导入`}
              description={
                <div className="space-y-2">
                  <Button size="small" icon={<CopyOutlined />} onClick={() => void handleCopyImportFailures()}>
                    复制失败明细
                  </Button>
                  <div className="max-h-56 space-y-1 overflow-auto pr-2 text-xs">
                    {importFailures.slice(0, 80).map((failure) => (
                      <div key={`${failure.line}-${failure.email ?? ""}-${failure.reason}`} className="flex gap-2">
                        <span className="shrink-0 text-slate-400">第 {failure.line} 行</span>
                        {failure.email ? <span className="shrink-0 text-slate-600">{failure.email}</span> : null}
                        <span className="text-red-500">{failure.reason}</span>
                      </div>
                    ))}
                    {importFailures.length > 80 ? <div className="text-slate-400">还有 {importFailures.length - 80} 条失败未展开显示</div> : null}
                  </div>
                </div>
              }
            />
          ) : null}
          <div className="text-xs text-slate-400">同一用户重复导入同一个邮箱时，会自动更新 token；四段格式会同步更新密码，三段格式会保留旧密码。</div>
        </div>
      </Modal>

      <Modal
        title="生成取码链接并导入CDK"
        open={cdkImportModalOpen}
        onCancel={() => {
          if (!cdkImporting) {
            setCdkImportModalOpen(false);
          }
        }}
        footer={[
          <Button key="cancel" disabled={cdkImporting} onClick={() => setCdkImportModalOpen(false)}>
            取消
          </Button>,
          <Button
            key="import"
            type="primary"
            icon={<LinkOutlined />}
            loading={cdkImporting}
            disabled={cdkProductOptions.length === 0}
            onClick={() => void handleGenerateLinksAndImportCdk()}
          >
            生成并导入
          </Button>,
        ]}
        width={620}
      >
        <div className="space-y-4">
          <Alert
            type="info"
            showIcon
            message={`将处理选中的 ${selectedAccounts.length} 个邮箱`}
            description="已有网页取码链接会直接复用；没有链接的邮箱会自动生成链接，然后把这些链接批量导入到商品CDK库存。重复导入相同链接会被后端跳过。"
          />
          <div className="space-y-2">
            <div className="text-xs text-slate-400">对应CDK商品</div>
            <Select
              className="w-full"
              loading={cdkProductsLoading}
              disabled={cdkImporting}
              value={cdkProductId}
              options={cdkProductOptions}
              placeholder="选择虚拟CDK邮件商品"
              onChange={setCdkProductId}
              notFoundContent={cdkProductsLoading ? "加载中" : "暂无虚拟CDK邮件商品"}
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs text-slate-400">导入备注</div>
            <Input
              maxLength={300}
              showCount
              disabled={cdkImporting}
              value={cdkImportNote}
              onChange={(event) => setCdkImportNote(event.target.value)}
              placeholder="例如：邮箱取码链接"
            />
          </div>
          {cdkImporting ? (
            <Alert
              type="warning"
              showIcon
              message={`正在生成取码链接 ${cdkImportProgress.done}/${cdkImportProgress.total}`}
              description={
                <Progress
                  percent={
                    cdkImportProgress.total > 0
                      ? Math.round((cdkImportProgress.done / cdkImportProgress.total) * 100)
                      : 0
                  }
                  size="small"
                />
              }
            />
          ) : null}
        </div>
      </Modal>

      <Modal
        title="生成取码链接"
        open={Boolean(publicLinkModalAccount)}
        onCancel={() => {
          setPublicLinkModalAccount(null);
          setPublicLinkTargetEmail("");
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setPublicLinkModalAccount(null);
              setPublicLinkTargetEmail("");
            }}
          >
            取消
          </Button>,
          <Button
            key="generate"
            type="primary"
            icon={<LinkOutlined />}
            loading={publicLinkLoadingId === publicLinkModalAccount?.id}
            onClick={() => {
              if (publicLinkModalAccount) {
                void handleGeneratePublicLink(publicLinkModalAccount, publicLinkTargetEmail);
              }
            }}
          >
            生成并复制
          </Button>,
        ]}
        width={520}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs text-slate-400">主邮箱</div>
            <Input value={publicLinkModalAccount?.email ?? ""} readOnly />
          </div>
          <div className="space-y-2">
            <div className="text-xs text-slate-400">链接绑定邮箱</div>
            <Select
              className="w-full"
              value={publicLinkTargetEmail || publicLinkTargetOptions[0]?.value}
              options={publicLinkTargetOptions}
              onChange={setPublicLinkTargetEmail}
            />
          </div>
          {publicLinkModalAccount?.publicCodeEnabled ? (
            <Alert type="warning" showIcon message="重新生成后，旧取码链接会立即失效。" />
          ) : (
            <Alert type="info" showIcon message="生成的是网页端取码链接，可重复打开；停用或重新生成后旧链接才会失效。" />
          )}
        </div>
      </Modal>

      <Modal
        title="维护子邮箱"
        open={Boolean(subEmailModalAccount)}
        onCancel={() => {
          setSubEmailModalAccount(null);
          setSubEmailContent("");
          setSubEmailGptRegisteredEmails([]);
          setSubEmailGrokRegisteredEmails([]);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setSubEmailModalAccount(null);
              setSubEmailContent("");
              setSubEmailGptRegisteredEmails([]);
              setSubEmailGrokRegisteredEmails([]);
            }}
          >
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={metadataSavingId === subEmailModalAccount?.id}
            onClick={() => void handleSaveSubEmails()}
          >
            保存
          </Button>,
        ]}
        width={620}
      >
        <div className="space-y-4">
          <Alert
            type="info"
            showIcon
            message="子邮箱会作为该主邮箱的别名管理"
            description="如果验证码发到这些子邮箱，仍然点击主邮箱这一行获取验证码；这些地址只用于备注和区分用途。"
          />
          <div className="space-y-2">
            <div className="text-xs text-slate-400">主邮箱</div>
            <Input value={subEmailModalAccount?.email ?? ""} readOnly />
          </div>
          <div className="space-y-2">
            <div className="text-xs text-slate-400">子邮箱，每行一个，也支持逗号或空格分隔</div>
            <TextArea
              rows={8}
              value={subEmailContent}
              onChange={(event) => setSubEmailContent(event.target.value)}
              placeholder={"alias1@hotmail.com\nalias2@outlook.com"}
              className="font-mono text-xs"
            />
          </div>
          {parseSubEmails(subEmailContent).length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs text-slate-400">子邮箱注册标记</div>
              <div className="max-h-48 space-y-2 overflow-auto rounded border border-slate-100 bg-slate-50 p-3">
                {parseSubEmails(subEmailContent).map((subEmail) => (
                  <div key={subEmail} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white px-3 py-2">
                    <span className="font-mono text-xs text-slate-600">{subEmail}</span>
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={subEmailGptRegisteredEmails.includes(subEmail)}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSubEmailGptRegisteredEmails((prev) =>
                            checked ? Array.from(new Set([...prev, subEmail])) : prev.filter((email) => email !== subEmail),
                          );
                        }}
                      >
                        GPT
                      </Checkbox>
                      <Checkbox
                        checked={subEmailGrokRegisteredEmails.includes(subEmail)}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSubEmailGrokRegisteredEmails((prev) =>
                            checked ? Array.from(new Set([...prev, subEmail])) : prev.filter((email) => email !== subEmail),
                          );
                        }}
                      >
                        Grok
                      </Checkbox>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        title="邮箱密码"
        open={Boolean(passwordResult)}
        onCancel={() => setPasswordResult(null)}
        footer={[
          <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={() => void handleCopyPassword()}>
            复制密码
          </Button>,
          <Button key="close" onClick={() => setPasswordResult(null)}>
            关闭
          </Button>,
        ]}
        width={560}
      >
        {passwordResult ? (
          <div className="space-y-4">
            <Alert type="warning" showIcon message="密码只在本次查看时解密显示，请确认当前设备和浏览器环境安全。" />
            <div className="space-y-2">
              <div className="text-xs text-slate-400">邮箱</div>
              <Input value={passwordResult.email} readOnly />
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-400">密码</div>
              <Input.Password value={passwordResult.password} readOnly visibilityToggle />
            </div>
          </div>
        ) : null}
      </Modal>
    </MainLayout>
  );
}

import { Avatar, Button, Card, QRCode, Tag, Tooltip, Typography } from "antd";
import { DownloadOutlined, LinkOutlined, LockOutlined } from "@ant-design/icons";
import { useMemo } from "react";

import { resolveAssetUrl } from "../lib/media";
import { buildDirectDownloadUrl, buildVerifyPageUrl, type DownloadItem } from "../services/downloadService";

export type { DownloadItem } from "../services/downloadService";

const { Paragraph } = Typography;
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

type Props = DownloadItem & {
  onLockedClick?: () => void;
  onDirectDownload?: () => void;
  onOpenLink?: () => void;
  badgeText?: string;
};

function formatUpdateTime(value?: string | null) {
  if (!value) {
    return "未知";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

function shortenChecksum(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return "暂未提供";
  }
  if (normalized.length <= 22) {
    return normalized;
  }
  return `${normalized.slice(0, 10)}...${normalized.slice(-8)}`;
}

export default function DownloadCard({
  title,
  version,
  changelog,
  url,
  icon,
  locked,
  passwordProtected,
  category,
  fileSize,
  checksumSha256,
  downloadCount,
  updateTime,
  onLockedClick,
  onDirectDownload,
  onOpenLink,
  badgeText,
}: Props) {
  const safeUrl = url ?? "";
  const downloadUrl = useMemo(() => buildDirectDownloadUrl(safeUrl, title), [safeUrl, title]);
  const requiresVerification = Boolean(locked || passwordProtected);
  const verifyUrl = useMemo(
    () =>
      buildVerifyPageUrl(safeUrl, title, {
        captchaRequired: Boolean(locked),
        passwordRequired: Boolean(passwordProtected),
      }),
    [locked, passwordProtected, safeUrl, title],
  );
  const iconSrc = resolveAssetUrl(icon) || "/images/idncar.jpg";
  const checksumLabel = shortenChecksum(checksumSha256);
  const updateLabel = formatUpdateTime(updateTime);

  return (
    <Card
      hoverable
      bodyStyle={{ height: "100%", padding: 0 }}
      className="h-full overflow-hidden rounded-[24px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.98))] shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition duration-300 hover:border-[#d7e3f1] hover:shadow-[0_26px_52px_rgba(15,23,42,0.08)]"
    >
      <div className="flex h-full flex-col p-5">
        <div className="flex items-start gap-3">
          <Avatar
            src={iconSrc}
            shape="square"
            size={56}
            className="flex-shrink-0 rounded-2xl border border-white bg-slate-50 shadow-sm"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <Tooltip title={title}>
                <h2 className="line-clamp-2 min-w-0 text-lg font-semibold leading-7 text-slate-900">{title}</h2>
              </Tooltip>
              <div className="flex flex-shrink-0 flex-wrap justify-end gap-1">
                {badgeText ? <Tag color="gold">{badgeText}</Tag> : null}
                <Tag color={requiresVerification ? "orange" : "green"}>
                  {passwordProtected
                    ? locked
                      ? "验证码 + 密码"
                      : "密码下载"
                    : locked
                      ? "验证码下载"
                      : "开放下载"}
                </Tag>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Tag color="blue">{category || "未分类"}</Tag>
              <Tag>{version || "未标注版本"}</Tag>
              <Tag>{fileSize || "大小未知"}</Tag>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 rounded-[20px] bg-[#f7f9fc] p-4 text-xs text-slate-500 sm:grid-cols-2">
          <div>
            <div className="text-[11px] text-slate-400">更新时间</div>
            <div className="mt-1 text-sm font-medium text-slate-700">{updateLabel}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">下载次数</div>
            <div className="mt-1 text-sm font-medium text-slate-700">{downloadCount ?? 0}</div>
          </div>
          <div className="sm:col-span-2">
            <div className="text-[11px] text-slate-400">SHA256 校验</div>
            <Tooltip title={checksumSha256 || "暂未提供"}>
              <div className="mt-1 break-all text-sm font-medium text-slate-700">{checksumLabel}</div>
            </Tooltip>
          </div>
        </div>

        <div className="mt-4">
          {changelog ? (
            <Paragraph
              ellipsis={{ rows: 2, expandable: true, symbol: "展开" }}
              className="!mb-0 min-h-[74px] rounded-[20px] border border-slate-100 bg-white px-4 py-3 text-sm leading-6 text-slate-600"
            >
              {changelog}
            </Paragraph>
          ) : (
            <div className="min-h-[74px] rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-400">
              暂无更新说明
            </div>
          )}
        </div>

        <div className="mt-4 hidden items-center justify-between gap-3 rounded-[20px] border border-slate-100 bg-white/90 p-3 sm:flex">
          <div>
            <div className="text-sm font-medium text-slate-700">手机扫码访问</div>
            <div className="mt-1 text-xs leading-5 text-slate-400">适合移动端转存或验证下载</div>
          </div>
          <QRCode value={verifyUrl} size={76} />
        </div>

        <div className="mt-auto grid grid-cols-1 gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
          {requiresVerification ? (
            <Button
              type="primary"
              className="w-full rounded-full border-none bg-[#2a6df4] shadow-[0_10px_24px_rgba(42,109,244,0.18)]"
              icon={<LockOutlined />}
              onClick={onLockedClick}
            >
              {passwordProtected ? "验证密码下载" : "验证码下载"}
            </Button>
          ) : (
            <Button
              type="primary"
              className="w-full rounded-full border-none bg-[#2a6df4] shadow-[0_10px_24px_rgba(42,109,244,0.18)]"
              icon={<DownloadOutlined />}
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onDirectDownload}
            >
              直接下载
            </Button>
          )}
            <Button
              className="w-full rounded-full border-slate-200 bg-white"
              icon={<LinkOutlined />}
              href={requiresVerification ? verifyUrl : downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onOpenLink}
            >
              {requiresVerification ? "打开验证页" : "打开直链"}
            </Button>
        </div>
      </div>
    </Card>
  );
}

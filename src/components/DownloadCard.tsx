import { Avatar, Button, Card, Col, QRCode, Row, Space, Tag, Tooltip, Typography } from "antd";
import { DownloadOutlined, InfoCircleOutlined, LinkOutlined, LockOutlined } from "@ant-design/icons";
import { useMemo } from "react";

import { buildVerifyPageUrl, resolveDownloadUrl, type DownloadItem } from "../services/downloadService";

export type { DownloadItem } from "../services/downloadService";

const { Paragraph, Text } = Typography;

type Props = DownloadItem & {
  onLockedClick?: () => void;
  onDirectDownload?: () => void;
  onOpenLink?: () => void;
  badgeText?: string;
};

export default function DownloadCard({
  title,
  version,
  changelog,
  url,
  icon,
  locked,
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
  const directUrl = useMemo(() => resolveDownloadUrl(safeUrl), [safeUrl]);
  const verifyUrl = useMemo(() => buildVerifyPageUrl(safeUrl, title), [safeUrl, title]);

  return (
    <Card
      hoverable
      bodyStyle={{ padding: 22 }}
      className="overflow-visible rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.98))] shadow-[0_18px_40px_rgba(15,23,42,0.06)] transition duration-300 hover:border-[#d7e3f1] hover:shadow-[0_26px_52px_rgba(15,23,42,0.08)]"
    >
      <Row gutter={[16, 12]} align="middle">
        <Col xs={24} sm={18} style={{ minWidth: 0 }}>
          <div className="flex items-start gap-3">
            <Avatar
              src={icon || "/images/idncar.jpg"}
              shape="square"
              size={60}
              className="rounded-2xl border border-white bg-slate-50 shadow-sm"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Text strong style={{ fontSize: 18 }} ellipsis={{ tooltip: title }} title={title}>
                  {title}
                </Text>
                <Tooltip title="资源信息">
                  <InfoCircleOutlined className="text-slate-400" />
                </Tooltip>
                {badgeText ? <Tag color="gold">{badgeText}</Tag> : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Tag color="blue">{category || "未分类"}</Tag>
                <Tag>{version || "未标注版本"}</Tag>
                <Tag>{fileSize || "大小未知"}</Tag>
                <Tag color={locked ? "orange" : "green"}>{locked ? "验证后下载" : "直接下载"}</Tag>
              </div>

              <div className="mt-4 grid gap-2 rounded-[22px] bg-[#f7f9fc] p-4 text-xs text-slate-500 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Updated</div>
                  <div className="mt-1 text-sm text-slate-700">{updateTime || "未知"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Downloads</div>
                  <div className="mt-1 text-sm text-slate-700">{downloadCount ?? 0}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">SHA256</div>
                  <div className="mt-1 break-all text-sm text-slate-700">{checksumSha256 || "暂未提供"}</div>
                </div>
              </div>

              <div className="mt-4">
                {changelog ? (
                  <Paragraph
                    ellipsis={{ rows: 2, expandable: true, symbol: "展开" }}
                    className="!mb-0 rounded-[22px] border border-slate-100 bg-white px-4 py-3 text-slate-600"
                  >
                    {changelog}
                  </Paragraph>
                ) : (
                  <div className="rounded-[22px] border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-400">
                    暂无更新说明
                  </div>
                )}
              </div>
            </div>
          </div>
        </Col>

        <Col xs={24} sm={6} className="flex justify-center">
          <div className="rounded-[24px] border border-slate-100 bg-white/90 p-3 shadow-sm">
            <QRCode value={verifyUrl} size={96} />
            <div className="mt-3 text-center text-xs tracking-[0.12em] text-slate-400">扫码访问</div>
          </div>
        </Col>

        <Col span={24}>
          <Space wrap size={10}>
            {locked ? (
              <Button
                type="primary"
                className="rounded-full border-none bg-[#2a6df4] shadow-[0_10px_24px_rgba(42,109,244,0.18)]"
                icon={<LockOutlined />}
                onClick={onLockedClick}
              >
                输入验证码下载
              </Button>
            ) : (
              <Button
                type="primary"
                className="rounded-full border-none bg-[#2a6df4] shadow-[0_10px_24px_rgba(42,109,244,0.18)]"
                icon={<DownloadOutlined />}
                href={directUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onDirectDownload}
              >
                直接下载
              </Button>
            )}
            <Button
              className="rounded-full border-slate-200 bg-white"
              icon={<LinkOutlined />}
              href={directUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onOpenLink}
            >
              打开直链
            </Button>
          </Space>
        </Col>
      </Row>
    </Card>
  );
}

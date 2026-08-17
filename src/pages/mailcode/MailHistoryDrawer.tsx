import { useEffect, useState } from "react";
import {
  LeftOutlined,
  MailOutlined,
  PaperClipOutlined,
  ReloadOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { Alert, Button, Drawer, Empty, Spin, Tag, Tooltip } from "antd";

import { getErrorMessage } from "../../lib/errorMessage";
import { toolsApi } from "../../services/api/tools";
import type { HotmailAccount, HotmailMessage } from "../../types/app";
import { formatDateTime } from "./mailCodeHelpers";

const PAGE_SIZE = 20;

interface MailHistoryDrawerProps {
  account: HotmailAccount | null;
  open: boolean;
  onClose: () => void;
}

export function MailHistoryDrawer({ account, open, onClose }: MailHistoryDrawerProps) {
  const [page, setPage] = useState(1);
  const [messages, setMessages] = useState<HotmailMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HotmailMessage | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (open) {
      setPage(1);
    }
  }, [account?.id, open]);

  useEffect(() => {
    if (!open || !account) {
      return;
    }

    let active = true;
    setListLoading(true);
    setListError(null);
    setMessages([]);
    setHasMore(false);
    setSelectedMessageId(null);
    setDetail(null);
    setDetailError(null);

    void toolsApi
      .getHotmailMessages(account.id, page, PAGE_SIZE)
      .then((response) => {
        if (!active) return;
        setMessages(response.messages);
        setHasMore(response.hasMore);
        setSelectedMessageId(response.messages[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setListError(getErrorMessage(error, "加载历史邮件失败"));
      })
      .finally(() => {
        if (active) setListLoading(false);
      });

    return () => {
      active = false;
    };
  }, [account, open, page, reloadKey]);

  useEffect(() => {
    if (!open || !account || !selectedMessageId) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    let active = true;
    setDetailLoading(true);
    setDetail(null);
    setDetailError(null);

    void toolsApi
      .getHotmailMessage(account.id, selectedMessageId)
      .then((response) => {
        if (active) setDetail(response);
      })
      .catch((error: unknown) => {
        if (active) setDetailError(getErrorMessage(error, "加载邮件正文失败"));
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [account, open, selectedMessageId]);

  const title = (
    <div className="min-w-0">
      <div>历史邮件</div>
      <div className="truncate text-xs font-normal text-slate-500">{account?.email}</div>
    </div>
  );

  return (
    <Drawer
      title={title}
      placement="right"
      width="min(960px, 100vw)"
      open={open}
      onClose={onClose}
      destroyOnHidden
      styles={{ body: { padding: 0, overflow: "hidden" } }}
    >
      <div className="grid h-full min-h-0 grid-rows-[minmax(220px,42%)_minmax(0,1fr)] md:grid-cols-[320px_minmax(0,1fr)] md:grid-rows-1">
        <section className="flex min-h-0 flex-col border-b border-slate-200 md:border-r md:border-b-0">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-100 px-3">
            <span className="text-sm font-medium text-slate-700">全部邮件</span>
            <Tooltip title="刷新">
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                loading={listLoading}
                onClick={() => setReloadKey((value) => value + 1)}
              />
            </Tooltip>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {listLoading ? (
              <div className="flex h-full min-h-40 items-center justify-center">
                <Spin />
              </div>
            ) : listError ? (
              <div className="p-3">
                <Alert type="error" showIcon message={listError} />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full min-h-40 items-center justify-center">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史邮件" />
              </div>
            ) : (
              messages.map((mail) => {
                const selected = mail.id === selectedMessageId;
                return (
                  <button
                    key={mail.id}
                    type="button"
                    className={`block w-full border-b border-slate-100 px-3 py-3 text-left transition-colors ${
                      selected ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                    }`}
                    onClick={() => setSelectedMessageId(mail.id)}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {!mail.read ? <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" aria-label="未读" /> : null}
                      <span className={`min-w-0 flex-1 truncate text-sm ${mail.read ? "text-slate-700" : "font-semibold text-slate-900"}`}>
                        {mail.senderName || mail.senderEmail || "未知发件人"}
                      </span>
                      {mail.hasAttachments ? <PaperClipOutlined className="shrink-0 text-slate-400" aria-label="含附件" /> : null}
                    </div>
                    <div className={`mt-1 truncate text-sm ${mail.read ? "text-slate-600" : "font-medium text-slate-800"}`}>
                      {mail.subject || "（无主题）"}
                    </div>
                    {mail.preview ? <div className="mt-1 max-h-10 overflow-hidden break-words text-xs leading-5 text-slate-400">{mail.preview}</div> : null}
                    <div className="mt-1 text-xs text-slate-400">{formatDateTime(mail.receivedTime)}</div>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex h-12 shrink-0 items-center justify-between border-t border-slate-100 px-3">
            <span className="text-xs text-slate-500">第 {page} 页</span>
            <div className="flex gap-1">
              <Tooltip title="上一页">
                <Button
                  size="small"
                  icon={<LeftOutlined />}
                  disabled={listLoading || page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                />
              </Tooltip>
              <Tooltip title="下一页">
                <Button
                  size="small"
                  icon={<RightOutlined />}
                  disabled={listLoading || !hasMore}
                  onClick={() => setPage((value) => value + 1)}
                />
              </Tooltip>
            </div>
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto bg-white">
          {detailLoading ? (
            <div className="flex h-full min-h-52 items-center justify-center">
              <Spin />
            </div>
          ) : detailError ? (
            <div className="p-4 md:p-6">
              <Alert type="error" showIcon message={detailError} />
            </div>
          ) : detail ? (
            <article className="p-4 md:p-6">
              <header className="border-b border-slate-200 pb-4">
                <h2 className="break-words text-lg font-semibold text-slate-900">{detail.subject || "（无主题）"}</h2>
                <div className="mt-3 space-y-1 text-sm text-slate-500">
                  <div className="flex min-w-0 items-center gap-2">
                    <MailOutlined className="shrink-0" />
                    <span className="break-all">
                      {detail.senderName || "未知发件人"}
                      {detail.senderEmail ? ` <${detail.senderEmail}>` : ""}
                    </span>
                  </div>
                  <div>{formatDateTime(detail.receivedTime)}</div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {!detail.read ? <Tag color="blue">未读</Tag> : <Tag>已读</Tag>}
                    {detail.hasAttachments ? <Tag icon={<PaperClipOutlined />}>含附件</Tag> : null}
                    {detail.bodyTruncated ? <Tag color="orange">正文已截断</Tag> : null}
                  </div>
                </div>
              </header>
              <div className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                {detail.bodyText || "这封邮件没有可显示的正文。"}
              </div>
            </article>
          ) : (
            <div className="flex h-full min-h-52 items-center justify-center">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择一封邮件查看正文" />
            </div>
          )}
        </section>
      </div>
    </Drawer>
  );
}

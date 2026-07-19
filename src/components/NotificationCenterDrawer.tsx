import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Checkbox,
  Drawer,
  Empty,
  List,
  Segmented,
  Space,
  Tag,
  Spin,
  message,
} from "antd";

import { useAuth } from "../context/useAuth";
import { getErrorMessage } from "../lib/errorMessage";
import { lcAnchors } from "../router/routeAccess";
import { notificationApi } from "../services/api/notification";
import { siteNoticeApi } from "../services/api/siteNotice";
import type { SiteNotice, UserNotification } from "../types/app";

interface NotificationCenterDrawerProps {
  open: boolean;
  onClose: () => void;
  onUnreadCountChange: Dispatch<SetStateAction<number>>;
}

interface NotificationListItem {
  key: string;
  title: string;
  content: string;
  createTime?: string | null;
  path?: string | null;
  read: boolean;
  source: "notice" | "message";
  notificationId?: number;
}

type NotificationFilter = "ALL" | "UNREAD" | "MESSAGE" | "NOTICE";
const NOTIFICATION_PAGE_SIZE = 20;

export default function NotificationCenterDrawer({
  open,
  onClose,
  onUnreadCountChange,
}: NotificationCenterDrawerProps) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationListItem[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>("ALL");
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<
    number[]
  >([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const loadRequestRef = useRef(0);

  const navigateToPath = useCallback(
    (path: string) => {
      if (/^https?:\/\//.test(path)) {
        window.location.assign(path);
        return;
      }

      navigate(path);
      if (!path.includes("#")) {
        return;
      }

      const hash = path.slice(path.indexOf("#") + 1);
      window.setTimeout(() => {
        document
          .getElementById(hash)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    },
    [navigate],
  );

  const loadNotificationCenter = useCallback(async () => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    const isLatestRequest = () => loadRequestRef.current === requestId;

    if (!isAuthenticated) {
      setLoading(false);
      setItems([]);
      setSelectedNotificationIds([]);
      setHasMoreMessages(false);
      setLoadingMoreMessages(false);
      onUnreadCountChange(0);
      return;
    }

    setLoading(true);
    try {
      const [notifications, unread, notices] = await Promise.all([
        notificationApi.getNotifications(NOTIFICATION_PAGE_SIZE),
        notificationApi.getUnreadCount(),
        siteNoticeApi.getSiteNotices().catch(() => [] as SiteNotice[]),
      ]);

      const personalItems: NotificationListItem[] = notifications.map(
        (item: UserNotification) => ({
          key: `message-${item.id}`,
          title: item.title,
          content: item.content,
          createTime: item.createTime,
          path: item.relatedPath,
          read: item.read,
          source: "message",
          notificationId: item.id,
        }),
      );

      const noticeItems: NotificationListItem[] = notices
        .slice(0, 6)
        .map((item) => ({
          key: `notice-${item.id}`,
          title: item.title,
          content: item.content,
          createTime: item.updateTime ?? item.createTime,
          path: lcAnchors.siteNotices,
          read: true,
          source: "notice",
        }));

      if (!isLatestRequest()) {
        return;
      }

      setItems(
        [...personalItems, ...noticeItems].sort(
          (a, b) =>
            new Date(b.createTime ?? 0).getTime() -
            new Date(a.createTime ?? 0).getTime(),
        ),
      );
      setSelectedNotificationIds([]);
      setHasMoreMessages(notifications.length === NOTIFICATION_PAGE_SIZE);
      onUnreadCountChange(unread.count ?? 0);
    } catch (error) {
      if (isLatestRequest()) {
        message.error(getErrorMessage(error, "加载消息中心失败"));
      }
    } finally {
      if (isLatestRequest()) {
        setLoading(false);
      }
    }
  }, [isAuthenticated, onUnreadCountChange]);

  useEffect(() => {
    if (open) {
      void loadNotificationCenter();
    }

    return () => {
      loadRequestRef.current += 1;
    };
  }, [loadNotificationCenter, open]);

  async function handleLoadMoreMessages() {
    if (loadingMoreMessages || !hasMoreMessages) {
      return;
    }
    const beforeId = items.reduce(
      (oldestId, item) => item.notificationId ? Math.min(oldestId, item.notificationId) : oldestId,
      Number.MAX_SAFE_INTEGER,
    );
    if (beforeId === Number.MAX_SAFE_INTEGER) {
      setHasMoreMessages(false);
      return;
    }

    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    setLoadingMoreMessages(true);
    try {
      const notifications = await notificationApi.getNotifications(NOTIFICATION_PAGE_SIZE, beforeId);
      if (loadRequestRef.current !== requestId) {
        return;
      }
      const nextItems: NotificationListItem[] = notifications.map((item) => ({
        key: `message-${item.id}`,
        title: item.title,
        content: item.content,
        createTime: item.createTime,
        path: item.relatedPath,
        read: item.read,
        source: "message",
        notificationId: item.id,
      }));
      setItems((current) => {
        const merged = new Map(current.map((item) => [item.key, item]));
        nextItems.forEach((item) => merged.set(item.key, item));
        return [...merged.values()].sort(
          (a, b) => new Date(b.createTime ?? 0).getTime() - new Date(a.createTime ?? 0).getTime(),
        );
      });
      setHasMoreMessages(notifications.length === NOTIFICATION_PAGE_SIZE);
    } catch (error) {
      if (loadRequestRef.current === requestId) {
        message.error(getErrorMessage(error, "加载更多消息失败"));
      }
    } finally {
      if (loadRequestRef.current === requestId) {
        setLoadingMoreMessages(false);
      }
    }
  }

  async function handleNotificationClick(item: NotificationListItem) {
    if (item.source === "message" && item.notificationId && !item.read) {
      try {
        await notificationApi.markRead(item.notificationId);
        onUnreadCountChange((current) => Math.max(0, current - 1));
        setSelectedNotificationIds((current) =>
          current.filter((id) => id !== item.notificationId),
        );
        setItems((current) =>
          current.map((entry) =>
            entry.key === item.key ? { ...entry, read: true } : entry,
          ),
        );
      } catch {
        // Keep navigation responsive even if the read marker fails.
      }
    }

    onClose();
    if (item.path) {
      navigateToPath(item.path);
    }
  }

  async function handleMarkSelectedRead() {
    const selectedIdSet = new Set(selectedNotificationIds);
    const targets = items.filter(
      (item) =>
        item.source === "message" &&
        item.notificationId &&
        !item.read &&
        selectedIdSet.has(item.notificationId),
    );
    if (targets.length === 0) {
      message.warning("所选消息里没有未读项");
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.allSettled(
        targets.map((item) => notificationApi.markRead(item.notificationId!)),
      );
      const successIds = targets
        .filter((_, index) => results[index]?.status === "fulfilled")
        .map((item) => item.notificationId!)
        .filter((id) => Number.isFinite(id));
      if (successIds.length > 0) {
        const successIdSet = new Set(successIds);
        setItems((current) =>
          current.map((item) =>
            item.notificationId && successIdSet.has(item.notificationId)
              ? { ...item, read: true }
              : item,
          ),
        );
        setSelectedNotificationIds((current) =>
          current.filter((id) => !successIdSet.has(id)),
        );
        onUnreadCountChange((current) =>
          Math.max(0, current - successIds.length),
        );
        const failedCount = targets.length - successIds.length;
        message.success(
          `已标记 ${successIds.length} 条消息为已读${failedCount > 0 ? `，${failedCount} 条失败` : ""}`,
        );
      } else {
        message.error("所选消息标记已读失败");
      }
    } catch (error) {
      message.error(getErrorMessage(error, "操作失败"));
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAllRead() {
    try {
      await notificationApi.markAllRead();
      onUnreadCountChange(0);
      setItems((current) =>
        current.map((item) =>
          item.source === "message" ? { ...item, read: true } : item,
        ),
      );
      setSelectedNotificationIds([]);
      message.success("消息已全部标记为已读");
    } catch (error) {
      message.error(getErrorMessage(error, "操作失败"));
    }
  }

  const filteredItems = useMemo(() => {
    if (filter === "UNREAD") {
      return items.filter((item) => item.source === "message" && !item.read);
    }
    if (filter === "MESSAGE") {
      return items.filter((item) => item.source === "message");
    }
    if (filter === "NOTICE") {
      return items.filter((item) => item.source === "notice");
    }
    return items;
  }, [filter, items]);
  const unreadMessageCount = useMemo(
    () =>
      items.filter((item) => item.source === "message" && !item.read).length,
    [items],
  );
  const selectedUnreadCount = useMemo(() => {
    const selectedIdSet = new Set(selectedNotificationIds);
    return items.filter(
      (item) =>
        item.source === "message" &&
        item.notificationId &&
        !item.read &&
        selectedIdSet.has(item.notificationId),
    ).length;
  }, [items, selectedNotificationIds]);

  return (
    <Drawer
      title="消息中心"
      placement="right"
      width={380}
      open={open}
      onClose={onClose}
      extra={
        isAuthenticated ? (
          <Space size={8}>
            <Button
              type="link"
              className="px-0"
              disabled={selectedUnreadCount === 0}
              onClick={() => void handleMarkSelectedRead()}
            >
              所选已读
            </Button>
            <Button
              type="link"
              className="px-0"
              disabled={unreadMessageCount === 0}
              onClick={() => void handleMarkAllRead()}
            >
              全部已读
            </Button>
          </Space>
        ) : null
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spin />
        </div>
      ) : items.length === 0 ? (
        <Empty
          description="暂时还没有消息"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <>
          <div className="mb-4 space-y-3">
            <Segmented
              block
              value={filter}
              onChange={(value) => setFilter(value as NotificationFilter)}
              options={[
                { label: "全部", value: "ALL" },
                { label: `未读 ${unreadMessageCount}`, value: "UNREAD" },
                { label: "消息", value: "MESSAGE" },
                { label: "公告", value: "NOTICE" },
              ]}
            />
            {selectedNotificationIds.length > 0 ? (
              <Tag color="blue">
                已选 {selectedNotificationIds.length} 条，未读{" "}
                {selectedUnreadCount} 条
              </Tag>
            ) : null}
          </div>
          {filteredItems.length === 0 ? (
            <Empty
              description="当前筛选下没有消息"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <List
              dataSource={filteredItems}
              renderItem={(item) => (
                <List.Item className="px-0">
                  <div className="flex w-full items-start gap-3">
                    {item.source === "message" && item.notificationId ? (
                      <Checkbox
                        className="mt-5"
                        checked={selectedNotificationIds.includes(
                          item.notificationId,
                        )}
                        onChange={(event) => {
                          const notificationId = item.notificationId!;
                          setSelectedNotificationIds((current) =>
                            event.target.checked
                              ? Array.from(
                                  new Set([...current, notificationId]),
                                )
                              : current.filter((id) => id !== notificationId),
                          );
                        }}
                      />
                    ) : (
                      <span className="mt-5 w-4 shrink-0" />
                    )}
                    <button
                      type="button"
                      onClick={() => void handleNotificationClick(item)}
                      className={`min-w-0 flex-1 rounded-3xl border px-4 py-4 text-left transition ${
                        item.source === "message" && !item.read
                          ? "border-[#cfe0ff] bg-[#f6f9ff]"
                          : "border-slate-200 bg-white hover:border-[#d5e3ff] hover:bg-[#f8fbff]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <Tag
                            color={
                              item.source === "notice"
                                ? "blue"
                                : item.read
                                  ? "default"
                                  : "gold"
                            }
                          >
                            {item.source === "notice"
                              ? "站点公告"
                              : item.read
                                ? "已读消息"
                                : "未读消息"}
                          </Tag>
                          <div className="truncate font-medium text-slate-900">
                            {item.title}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-slate-400">
                          {item.createTime || ""}
                        </span>
                      </div>
                      <div className="mt-2 line-clamp-3 text-sm leading-7 text-slate-600">
                        {item.content}
                      </div>
                    </button>
                  </div>
                </List.Item>
              )}
            />
          )}
          {filter !== "NOTICE" && hasMoreMessages ? (
            <div className="flex justify-center pt-4">
              <Button loading={loadingMoreMessages} onClick={() => void handleLoadMoreMessages()}>
                加载更多消息
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Drawer>
  );
}

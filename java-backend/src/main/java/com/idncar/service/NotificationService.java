package com.idncar.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.idncar.exception.ApiException;
import com.idncar.mapper.UserNotificationMapper;
import com.idncar.model.dto.UserNotificationDto;
import com.idncar.model.entity.UserNotification;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class NotificationService {

    @Autowired
    private UserNotificationMapper userNotificationMapper;

    @Autowired
    private UserAccessService userAccessService;

    public List<UserNotificationDto> getNotifications(Long userId, Integer limit, Long beforeId) {
        userAccessService.requireActiveUser(userId);
        int safeLimit = limit == null ? 20 : Math.max(1, Math.min(limit, 100));
        QueryWrapper<UserNotification> query = new QueryWrapper<UserNotification>()
                .eq("user_id", userId)
                .orderByDesc("id")
                .last("LIMIT " + safeLimit);
        if (beforeId != null) {
            query.lt("id", beforeId);
        }

        return userNotificationMapper.selectList(query)
                .stream()
                .map(UserNotificationDto::fromEntity)
                .collect(Collectors.toList());
    }

    public long getUnreadCount(Long userId) {
        userAccessService.requireActiveUser(userId);
        Long count = userNotificationMapper.selectCount(new QueryWrapper<UserNotification>()
                .eq("user_id", userId)
                .eq("read_status", false));
        return count == null ? 0 : count;
    }

    public void markAsRead(Long userId, Long notificationId) {
        userAccessService.requireActiveUser(userId);
        UserNotification notification = userNotificationMapper.selectById(notificationId);
        if (notification == null || !notification.getUserId().equals(userId)) {
            throw ApiException.notFound("通知不存在");
        }

        if (!Boolean.TRUE.equals(notification.getReadStatus())) {
            notification.setReadStatus(true);
            notification.setReadTime(new Date());
            userNotificationMapper.updateById(notification);
        }
    }

    public void markAllAsRead(Long userId) {
        userAccessService.requireActiveUser(userId);
        userNotificationMapper.markAllAsReadByUserId(userId, new Date());
    }

    public void createNotification(Long userId, String type, String title, String content, String relatedPath) {
        if (userId == null || title == null || title.isBlank() || content == null || content.isBlank()) {
            return;
        }

        UserNotification notification = new UserNotification();
        notification.setUserId(userId);
        notification.setType(limitText(type == null ? "SYSTEM" : type.trim().toUpperCase(), 40));
        notification.setTitle(limitText(title.trim(), 120));
        notification.setContent(limitText(content.trim(), 500));
        notification.setRelatedPath(limitText(normalizeNullableText(relatedPath), 255));
        notification.setReadStatus(false);
        notification.setCreateTime(new Date());
        userNotificationMapper.insert(notification);
    }

    public void createNotifications(List<Long> userIds, String type, String title, String content, String relatedPath) {
        if (userIds == null || userIds.isEmpty() || title == null || title.isBlank() || content == null || content.isBlank()) {
            return;
        }

        Date now = new Date();
        List<UserNotification> notifications = userIds.stream()
                .filter(id -> id != null && id > 0)
                .distinct()
                .map(userId -> {
                    UserNotification notification = new UserNotification();
                    notification.setUserId(userId);
                    notification.setType(limitText(type == null ? "SYSTEM" : type.trim().toUpperCase(), 40));
                    notification.setTitle(limitText(title.trim(), 120));
                    notification.setContent(limitText(content.trim(), 500));
                    notification.setRelatedPath(limitText(normalizeNullableText(relatedPath), 255));
                    notification.setReadStatus(false);
                    notification.setCreateTime(now);
                    return notification;
                })
                .collect(Collectors.toList());

        if (!notifications.isEmpty()) {
            userNotificationMapper.insertBatch(notifications);
        }
    }

    private String normalizeNullableText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String limitText(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}

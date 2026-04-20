package com.idncar.service;

import com.idncar.model.dto.UserNotificationDto;

import java.util.List;

public interface NotificationService {

    List<UserNotificationDto> getNotifications(Long userId, Integer limit);

    long getUnreadCount(Long userId);

    void markAsRead(Long userId, Long notificationId);

    void markAllAsRead(Long userId);

    void createNotification(Long userId, String type, String title, String content, String relatedPath);

    void createNotifications(List<Long> userIds, String type, String title, String content, String relatedPath);
}

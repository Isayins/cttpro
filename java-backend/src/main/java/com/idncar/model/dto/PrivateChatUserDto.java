package com.idncar.model.dto;

public record PrivateChatUserDto(
        Long id,
        String nickname,
        String avatarUrl,
        String bio,
        Boolean online,
        Boolean blocked,
        Long unreadCount,
        Long lastMessageAt
) {
}

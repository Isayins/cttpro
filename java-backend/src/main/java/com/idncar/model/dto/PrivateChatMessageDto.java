package com.idncar.model.dto;

public record PrivateChatMessageDto(
        Long id,
        Long senderId,
        String senderNickname,
        String senderAvatarUrl,
        Long recipientId,
        String content,
        Long createdAt
) {
}

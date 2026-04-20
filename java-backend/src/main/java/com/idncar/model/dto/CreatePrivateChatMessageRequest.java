package com.idncar.model.dto;

public record CreatePrivateChatMessageRequest(
        Long recipientUserId,
        String content
) {
}

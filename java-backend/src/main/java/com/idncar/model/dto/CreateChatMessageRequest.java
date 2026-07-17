package com.idncar.model.dto;

public record CreateChatMessageRequest(
        String roomId,
        String content
) {
}

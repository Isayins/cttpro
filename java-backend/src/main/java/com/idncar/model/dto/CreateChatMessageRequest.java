package com.idncar.model.dto;

public record CreateChatMessageRequest(
        String roomId,
        String author,
        String avatarSeed,
        String content
) {
}

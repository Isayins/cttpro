package com.idncar.model.dto;

public record ChatRoomMessageDto(
        Long id,
        String roomId,
        String author,
        String avatarSeed,
        String content,
        Long createdAt
) {
}

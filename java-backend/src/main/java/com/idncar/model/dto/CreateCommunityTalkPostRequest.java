package com.idncar.model.dto;

public record CreateCommunityTalkPostRequest(
        String author,
        String avatarSeed,
        String content,
        String category
) {
}

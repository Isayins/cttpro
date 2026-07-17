package com.idncar.model.dto;

public record CreateCommunityTalkPostRequest(
        String content,
        String category
) {
}

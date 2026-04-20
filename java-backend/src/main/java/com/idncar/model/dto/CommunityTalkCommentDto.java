package com.idncar.model.dto;

public record CommunityTalkCommentDto(
        Long id,
        Long postId,
        String author,
        String content,
        Long createdAt
) {
}

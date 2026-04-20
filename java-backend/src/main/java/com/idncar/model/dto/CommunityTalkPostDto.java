package com.idncar.model.dto;

import java.util.List;

public record CommunityTalkPostDto(
        Long id,
        String author,
        String avatarSeed,
        String content,
        String category,
        Long createdAt,
        Integer likes,
        Boolean pinned,
        List<CommunityTalkCommentDto> comments
) {
    public CommunityTalkPostDto withComments(List<CommunityTalkCommentDto> nextComments) {
        return new CommunityTalkPostDto(id, author, avatarSeed, content, category, createdAt, likes, pinned, nextComments);
    }
}

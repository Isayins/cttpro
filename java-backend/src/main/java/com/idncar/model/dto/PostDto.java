package com.idncar.model.dto;

import com.idncar.model.entity.Post;
import lombok.Data;

import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Data
public class PostDto {

    private Long id;
    private String title;
    private String content;
    private String category;
    private List<String> tags;
    private Long userId;
    private String author;
    private String authorAvatarUrl;
    private Integer authorExperience;
    private Integer authorLevel;
    private String authorTitle;
    private String createTime;
    private String updateTime;
    private Integer viewCount;
    private Integer likeCount;
    private Integer favoriteCount;
    private Integer replyCount;
    private Boolean pinned;
    private Boolean likedByCurrentUser;
    private Boolean favoritedByCurrentUser;
    private Boolean canEdit;
    private Boolean canDelete;
    private Boolean canPin;

    public static PostDto fromEntity(
            Post post,
            String author,
            String authorAvatarUrl,
            Integer authorExperience,
            Integer authorLevel,
            String authorTitle,
            Integer replyCount,
            boolean likedByCurrentUser,
            boolean favoritedByCurrentUser,
            boolean canEdit,
            boolean canDelete,
            boolean canPin
    ) {
        PostDto dto = new PostDto();
        dto.setId(post.getId());
        dto.setTitle(post.getTitle());
        dto.setContent(post.getContent());
        dto.setCategory(post.getCategory());
        dto.setTags(splitTags(post.getTags()));
        dto.setUserId(post.getUserId());
        dto.setAuthor(author);
        dto.setAuthorAvatarUrl(authorAvatarUrl);
        dto.setAuthorExperience(authorExperience == null ? 0 : authorExperience);
        dto.setAuthorLevel(authorLevel == null ? 1 : authorLevel);
        dto.setAuthorTitle(authorTitle);
        dto.setCreateTime(formatDate(post.getCreateTime()));
        dto.setUpdateTime(formatDate(post.getUpdateTime()));
        dto.setViewCount(post.getViewCount());
        dto.setLikeCount(post.getLikeCount());
        dto.setFavoriteCount(post.getFavoriteCount());
        dto.setReplyCount(replyCount == null ? 0 : replyCount);
        dto.setPinned(Boolean.TRUE.equals(post.getPinned()));
        dto.setLikedByCurrentUser(likedByCurrentUser);
        dto.setFavoritedByCurrentUser(favoritedByCurrentUser);
        dto.setCanEdit(canEdit);
        dto.setCanDelete(canDelete);
        dto.setCanPin(canPin);
        return dto;
    }

    private static List<String> splitTags(String tags) {
        if (tags == null || tags.isBlank()) {
            return Collections.emptyList();
        }
        return Arrays.stream(tags.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .distinct()
                .collect(Collectors.toList());
    }

    private static String formatDate(java.util.Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}

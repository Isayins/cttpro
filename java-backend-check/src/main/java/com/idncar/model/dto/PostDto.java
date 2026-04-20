package com.idncar.model.dto;

import com.idncar.model.entity.Post;
import lombok.Data;

@Data
public class PostDto {

    private Long id;
    private String title;
    private String content;
    private Long userId;
    private String author;
    private String createTime;
    private String updateTime;
    private Integer viewCount;
    private Integer likeCount;

    public static PostDto fromEntity(Post post) {
        PostDto dto = new PostDto();
        dto.setId(post.getId());
        dto.setTitle(post.getTitle());
        dto.setContent(post.getContent());
        dto.setUserId(post.getUserId());
        dto.setAuthor(post.getAuthor());
        dto.setCreateTime(post.getCreateTime().toString());
        dto.setUpdateTime(post.getUpdateTime().toString());
        dto.setViewCount(post.getViewCount());
        dto.setLikeCount(post.getLikeCount());
        return dto;
    }
}

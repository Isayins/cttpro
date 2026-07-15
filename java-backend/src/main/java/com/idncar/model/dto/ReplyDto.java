package com.idncar.model.dto;

import com.idncar.model.entity.Reply;
import lombok.Data;

import java.text.SimpleDateFormat;

@Data
public class ReplyDto {

    private Long id;
    private Long postId;
    private String content;
    private Long userId;
    private String author;
    private String authorAvatarUrl;
    private Integer authorExperience;
    private Integer authorLevel;
    private String authorTitle;
    private String createTime;

    public static ReplyDto fromEntity(
            Reply reply,
            String author,
            String authorAvatarUrl,
            Integer authorExperience,
            Integer authorLevel,
            String authorTitle
    ) {
        ReplyDto dto = new ReplyDto();
        dto.setId(reply.getId());
        dto.setPostId(reply.getPostId());
        dto.setContent(reply.getContent());
        dto.setUserId(reply.getUserId());
        dto.setAuthor(author);
        dto.setAuthorAvatarUrl(authorAvatarUrl);
        dto.setAuthorExperience(authorExperience == null ? 0 : authorExperience);
        dto.setAuthorLevel(authorLevel == null ? 1 : authorLevel);
        dto.setAuthorTitle(authorTitle);
        dto.setCreateTime(formatDate(reply.getCreateTime()));
        return dto;
    }

    private static String formatDate(java.util.Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}

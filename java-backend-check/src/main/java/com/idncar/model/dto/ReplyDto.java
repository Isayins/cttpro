package com.idncar.model.dto;

import com.idncar.model.entity.Reply;
import lombok.Data;

@Data
public class ReplyDto {

    private Long id;
    private Long postId;
    private String content;
    private Long userId;
    private String author;
    private String createTime;

    public static ReplyDto fromEntity(Reply reply) {
        ReplyDto dto = new ReplyDto();
        dto.setId(reply.getId());
        dto.setPostId(reply.getPostId());
        dto.setContent(reply.getContent());
        dto.setUserId(reply.getUserId());
        dto.setAuthor(reply.getAuthor());
        dto.setCreateTime(reply.getCreateTime().toString());
        return dto;
    }
}

package com.idncar.model.dto;

import com.idncar.model.entity.ForumBoard;
import com.idncar.model.entity.User;
import lombok.Data;

import java.text.SimpleDateFormat;

@Data
public class ForumBoardDto {

    private Long id;
    private String name;
    private String description;
    private String avatarUrl;
    private Long ownerUserId;
    private String ownerNickname;
    private String ownerAvatarUrl;
    private String levelTitleConfig;
    private Integer sortOrder;
    private Boolean active;
    private String createTime;
    private String updateTime;

    public static ForumBoardDto fromEntity(ForumBoard board) {
        return fromEntity(board, null);
    }

    public static ForumBoardDto fromEntity(ForumBoard board, User owner) {
        ForumBoardDto dto = new ForumBoardDto();
        dto.setId(board.getId());
        dto.setName(board.getName());
        dto.setDescription(board.getDescription());
        dto.setAvatarUrl(board.getAvatarUrl());
        dto.setOwnerUserId(board.getOwnerUserId());
        dto.setOwnerNickname(owner == null ? null : owner.getNickname());
        dto.setOwnerAvatarUrl(owner == null ? null : owner.getAvatarUrl());
        dto.setLevelTitleConfig(board.getLevelTitleConfig());
        dto.setSortOrder(board.getSortOrder() == null ? 0 : board.getSortOrder());
        dto.setActive(Boolean.TRUE.equals(board.getActive()));
        dto.setCreateTime(formatDate(board.getCreateTime()));
        dto.setUpdateTime(formatDate(board.getUpdateTime()));
        return dto;
    }

    private static String formatDate(java.util.Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
    }
}

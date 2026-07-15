package com.idncar.model.dto;

import lombok.Data;

@Data
public class ForumLeaderboardUserDto {

    private Long userId;
    private String nickname;
    private String avatarUrl;
    private Integer level;
    private Integer experience;
    private String title;
    private Integer consecutiveSignInDays;
    private Integer postCountToday;
    private Integer replyCountToday;
    private Integer activityScore;
}

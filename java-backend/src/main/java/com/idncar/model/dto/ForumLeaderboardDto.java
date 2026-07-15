package com.idncar.model.dto;

import lombok.Data;

import java.util.List;

@Data
public class ForumLeaderboardDto {

    private List<ForumLeaderboardUserDto> signInRank;
    private List<ForumLeaderboardUserDto> activityRank;
}

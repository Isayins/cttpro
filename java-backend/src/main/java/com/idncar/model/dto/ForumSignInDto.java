package com.idncar.model.dto;

import lombok.Data;

@Data
public class ForumSignInDto {

    private Long boardId;
    private String boardName;
    private Boolean signedToday;
    private Integer consecutiveSignInDays;
    private Integer gainedExperience;
    private Integer experience;
    private Integer level;
    private String title;
    private String lastSignInAt;
}

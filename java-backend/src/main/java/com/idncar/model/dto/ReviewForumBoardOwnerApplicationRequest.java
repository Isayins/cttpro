package com.idncar.model.dto;

import lombok.Data;

@Data
public class ReviewForumBoardOwnerApplicationRequest {

    private Boolean approved;
    private String reviewNote;
}

package com.idncar.model.dto;

import lombok.Data;

@Data
public class SaveForumBoardRequest {

    private String name;
    private String description;
    private String avatarUrl;
    private Integer sortOrder;
    private Boolean active;
}

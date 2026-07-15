package com.idncar.model.dto;

import lombok.Data;

import java.util.List;

@Data
public class SaveForumBoardLevelTitlesRequest {

    private List<ForumBoardLevelTitleDto> titles;
}

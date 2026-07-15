package com.idncar.model.dto;

import lombok.Data;

import java.util.List;

@Data
public class BatchUpdateHotmailAccountGroupRequest {

    private List<Long> accountIds;

    private String groupName;
}

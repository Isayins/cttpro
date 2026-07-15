package com.idncar.model.dto;

import lombok.Data;

import java.util.List;

@Data
public class BatchDeleteHotmailAccountsRequest {

    private List<Long> accountIds;
}

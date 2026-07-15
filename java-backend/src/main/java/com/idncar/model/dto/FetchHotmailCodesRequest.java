package com.idncar.model.dto;

import lombok.Data;

import java.util.List;

@Data
public class FetchHotmailCodesRequest {

    private List<Long> accountIds;
}

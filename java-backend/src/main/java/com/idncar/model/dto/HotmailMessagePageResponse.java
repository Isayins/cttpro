package com.idncar.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class HotmailMessagePageResponse {

    private List<HotmailMessageDto> messages;

    private int page;

    private int size;

    private boolean hasMore;
}

package com.idncar.model.dto;

import lombok.Data;

import java.util.List;

@Data
public class PageResultDto<T> {

    private List<T> records;
    private Long total;
    private Integer page;
    private Integer size;

    public static <T> PageResultDto<T> of(List<T> records, Long total, Integer page, Integer size) {
        PageResultDto<T> dto = new PageResultDto<>();
        dto.setRecords(records);
        dto.setTotal(total == null ? 0L : total);
        dto.setPage(page);
        dto.setSize(size);
        return dto;
    }
}

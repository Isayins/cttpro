package com.idncar.model.dto;

import lombok.Data;

@Data
public class AdminProductStatsDto {

    private Long total;
    private Long published;
    private Long draft;
    private Long offline;

    public static AdminProductStatsDto of(Long total, Long published, Long draft, Long offline) {
        AdminProductStatsDto dto = new AdminProductStatsDto();
        dto.setTotal(total == null ? 0L : total);
        dto.setPublished(published == null ? 0L : published);
        dto.setDraft(draft == null ? 0L : draft);
        dto.setOffline(offline == null ? 0L : offline);
        return dto;
    }
}

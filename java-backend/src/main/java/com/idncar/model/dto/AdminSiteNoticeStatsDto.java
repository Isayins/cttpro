package com.idncar.model.dto;

import lombok.Data;

@Data
public class AdminSiteNoticeStatsDto {

    private Long total;
    private Long published;
    private Long draft;

    public static AdminSiteNoticeStatsDto of(Long total, Long published, Long draft) {
        AdminSiteNoticeStatsDto dto = new AdminSiteNoticeStatsDto();
        dto.setTotal(total == null ? 0L : total);
        dto.setPublished(published == null ? 0L : published);
        dto.setDraft(draft == null ? 0L : draft);
        return dto;
    }
}

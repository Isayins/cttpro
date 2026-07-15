package com.idncar.model.dto;

import lombok.Data;

@Data
public class AdminDownloadStatsDto {

    private Long total;
    private Long locked;
    private Long open;

    public static AdminDownloadStatsDto of(Long total, Long locked, Long open) {
        AdminDownloadStatsDto dto = new AdminDownloadStatsDto();
        dto.setTotal(total == null ? 0L : total);
        dto.setLocked(locked == null ? 0L : locked);
        dto.setOpen(open == null ? 0L : open);
        return dto;
    }
}

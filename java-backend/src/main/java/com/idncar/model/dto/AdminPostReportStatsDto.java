package com.idncar.model.dto;

import lombok.Data;

@Data
public class AdminPostReportStatsDto {

    private Long total;
    private Long pending;
    private Long resolved;
    private Long rejected;

    public static AdminPostReportStatsDto of(Long total, Long pending, Long resolved, Long rejected) {
        AdminPostReportStatsDto dto = new AdminPostReportStatsDto();
        dto.setTotal(total == null ? 0L : total);
        dto.setPending(pending == null ? 0L : pending);
        dto.setResolved(resolved == null ? 0L : resolved);
        dto.setRejected(rejected == null ? 0L : rejected);
        return dto;
    }
}

package com.idncar.model.dto;

import lombok.Data;

@Data
public class AdminInviteStatsDto {

    private Long total;
    private Long active;
    private Long used;
    private Long expired;

    public static AdminInviteStatsDto of(Long total, Long active, Long used, Long expired) {
        AdminInviteStatsDto dto = new AdminInviteStatsDto();
        dto.setTotal(total == null ? 0L : total);
        dto.setActive(active == null ? 0L : active);
        dto.setUsed(used == null ? 0L : used);
        dto.setExpired(expired == null ? 0L : expired);
        return dto;
    }
}

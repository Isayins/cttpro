package com.idncar.model.dto;

import lombok.Data;

@Data
public class AdminUserStatsDto {

    private Long total;
    private Long owner;
    private Long admin;
    private Long regular;
    private Long disabled;

    public static AdminUserStatsDto of(Long total, Long owner, Long admin, Long regular, Long disabled) {
        AdminUserStatsDto dto = new AdminUserStatsDto();
        dto.setTotal(total == null ? 0L : total);
        dto.setOwner(owner == null ? 0L : owner);
        dto.setAdmin(admin == null ? 0L : admin);
        dto.setRegular(regular == null ? 0L : regular);
        dto.setDisabled(disabled == null ? 0L : disabled);
        return dto;
    }
}

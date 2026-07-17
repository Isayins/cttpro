package com.idncar.model.dto;

import lombok.Data;

@Data
public class AdminPaymentOrderStatsDto {

    private Long total;
    private Long created;
    private Long waiting;
    private Long paid;
    private Long closed;
    private Long failed;
    private Long errors;
    private Long openSupport;

    public static AdminPaymentOrderStatsDto of(Long total, Long created, Long waiting, Long paid, Long closed,
                                                Long failed, Long errors, Long openSupport) {
        AdminPaymentOrderStatsDto dto = new AdminPaymentOrderStatsDto();
        dto.setTotal(total == null ? 0L : total);
        dto.setCreated(created == null ? 0L : created);
        dto.setWaiting(waiting == null ? 0L : waiting);
        dto.setPaid(paid == null ? 0L : paid);
        dto.setClosed(closed == null ? 0L : closed);
        dto.setFailed(failed == null ? 0L : failed);
        dto.setErrors(errors == null ? 0L : errors);
        dto.setOpenSupport(openSupport == null ? 0L : openSupport);
        return dto;
    }
}

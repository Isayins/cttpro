package com.idncar.model.dto;

public record CreateCommunityReportRequest(
        String targetType,
        Long targetId,
        String reason,
        String detail
) {
}

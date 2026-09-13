package com.idncar.model.dto;

public record RpsJoinRequestDto(
        String requestToken,
        String name,
        long requestedAtEpochMs,
        String status
) {
}

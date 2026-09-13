package com.idncar.model.dto;

public record RpsLobbyTableDto(
        String code,
        String ownerName,
        String accessMode,
        String phase,
        int joinedPlayers,
        boolean hasPendingRequests,
        long createdAtEpochMs
) {
}

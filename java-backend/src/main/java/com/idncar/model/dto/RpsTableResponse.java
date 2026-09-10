package com.idncar.model.dto;

import java.util.List;

public record RpsTableResponse(
        String code,
        String playerToken,
        String seat,
        String phase,
        int round,
        long serverNowEpochMs,
        Long revealAtEpochMs,
        RpsPlayerDto playerOne,
        RpsPlayerDto playerTwo,
        RpsScoreDto score,
        List<RpsRoundSummaryDto> history
) {
}

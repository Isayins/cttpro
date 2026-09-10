package com.idncar.model.dto;

public record RpsRoundSummaryDto(
        int round,
        String winner,
        String winnerName,
        String playerOneChoice,
        String playerTwoChoice
) {
}

package com.idncar.service;

import com.fasterxml.jackson.databind.JsonNode;

public interface QuantProxyService {

    JsonNode getState(String symbol, Integer limit);

    JsonNode listStocks();

    JsonNode getWeeklyData(String symbol);

    JsonNode getDatabaseSummary(String symbol);

    JsonNode getScreener(
            Integer top,
            Integer maxSymbols,
            String preset,
            Integer minAvgAmountK,
            Integer minLatestAmountK,
            Integer minFloatMarketCapW,
            Integer minTotalMarketCapW,
            Integer minListedDays,
            Boolean excludeSt,
            Boolean excludeBse,
            Boolean excludeSuspended,
            Boolean excludeNonListingStatus,
            Boolean forceRefresh,
            Boolean asyncJob
    );

    JsonNode startScreenerJob(
            Integer top,
            Integer maxSymbols,
            String preset,
            Integer minAvgAmountK,
            Integer minLatestAmountK,
            Integer minFloatMarketCapW,
            Integer minTotalMarketCapW,
            Integer minListedDays,
            Boolean excludeSt,
            Boolean excludeBse,
            Boolean excludeSuspended,
            Boolean excludeNonListingStatus,
            Boolean forceRefresh
    );

    JsonNode getScreenerJob(String jobId);

    JsonNode triggerBuy();

    JsonNode triggerSell();

    JsonNode startAutomation();

    JsonNode stopAutomation();

    JsonNode syncAllSupported(
            String startDate,
            String endDate,
            String stockStatuses,
            String fundMarkets,
            String fundStatuses,
            Integer limit
    );

    JsonNode syncAllAdjFactors(
            String startDate,
            String endDate,
            Integer stockLimit,
            Integer fundLimit
    );

    JsonNode syncAllIndices(
            String startDate,
            String endDate,
            String markets,
            Integer limit
    );

    JsonNode syncAllFinancials(
            String startDate,
            String endDate,
            String statuses,
            Integer limit
    );

    JsonNode syncAllBoards(Integer limit);
}

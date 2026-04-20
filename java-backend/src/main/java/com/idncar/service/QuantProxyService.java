package com.idncar.service;

import com.fasterxml.jackson.databind.JsonNode;

public interface QuantProxyService {

    JsonNode getState(String symbol, Integer limit);

    JsonNode listStocks();

    JsonNode getWeeklyData(String symbol);

    JsonNode triggerBuy();

    JsonNode triggerSell();

    JsonNode startAutomation();

    JsonNode stopAutomation();
}

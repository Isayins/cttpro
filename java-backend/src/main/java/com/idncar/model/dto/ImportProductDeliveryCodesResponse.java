package com.idncar.model.dto;

import lombok.Data;

import java.util.List;

@Data
public class ImportProductDeliveryCodesResponse {
    private String batchNo;
    private int importedCount;
    private int skippedCount;
    private List<ProductDeliveryCodeDto> records;

    public ImportProductDeliveryCodesResponse(String batchNo, int importedCount, int skippedCount, List<ProductDeliveryCodeDto> records) {
        this.batchNo = batchNo;
        this.importedCount = importedCount;
        this.skippedCount = skippedCount;
        this.records = records;
    }
}
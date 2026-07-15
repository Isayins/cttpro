package com.idncar.model.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ImportHotmailAccountsResponse {

    private String message;

    private int imported;

    private int skipped;

    private int duplicateCount;

    private int batchDuplicateCount;

    private int existingDuplicateCount;

    private List<HotmailImportFailure> failures = new ArrayList<>();
}

package com.idncar.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class PublicMailCodeFetchResponse {

    public static final int CODE_OK = 200;
    public static final int CODE_WAITING = 601;
    public static final String MESSAGE_OK = "Verification code fetched";
    public static final String MESSAGE_WAITING = "Waiting for verification code";

    private int code;

    private String message;

    private PublicMailCodeData data;

    public static PublicMailCodeFetchResponse ok(PublicMailCodeResult data) {
        return new PublicMailCodeFetchResponse(CODE_OK, MESSAGE_OK, PublicMailCodeData.fromResult(data));
    }

    public static PublicMailCodeFetchResponse waiting() {
        return new PublicMailCodeFetchResponse(CODE_WAITING, MESSAGE_WAITING, null);
    }

    public static PublicMailCodeFetchResponse error(int code, String message) {
        return new PublicMailCodeFetchResponse(code, message, null);
    }
}

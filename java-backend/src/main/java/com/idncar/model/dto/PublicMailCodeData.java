package com.idncar.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.Date;

@Data
@AllArgsConstructor
public class PublicMailCodeData {

    private String email;

    private String code;

    private Date receivedTime;

    private Date fetchTime;

    public static PublicMailCodeData fromResult(PublicMailCodeResult result) {
        return new PublicMailCodeData(
                result.getEmail(),
                result.getCode() == null ? null : result.getCode().trim(),
                result.getReceivedTime(),
                result.getFetchTime()
        );
    }
}

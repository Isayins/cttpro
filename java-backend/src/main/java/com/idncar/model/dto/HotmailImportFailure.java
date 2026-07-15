package com.idncar.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class HotmailImportFailure {

    private int line;

    private String email;

    private String reason;
}

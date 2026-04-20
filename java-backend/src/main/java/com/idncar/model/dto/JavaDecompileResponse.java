package com.idncar.model.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class JavaDecompileResponse {

    private String fileName;
    private String output;
    private String engine;
}

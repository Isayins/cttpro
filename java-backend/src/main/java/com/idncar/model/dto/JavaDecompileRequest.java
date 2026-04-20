package com.idncar.model.dto;

import lombok.Data;

@Data
public class JavaDecompileRequest {

    private String fileName;
    private String base64Content;
}

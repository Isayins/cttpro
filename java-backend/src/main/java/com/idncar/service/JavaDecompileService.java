package com.idncar.service;

import com.idncar.model.dto.JavaDecompileRequest;
import com.idncar.model.dto.JavaDecompileResponse;

public interface JavaDecompileService {

    JavaDecompileResponse decompile(JavaDecompileRequest request);
}

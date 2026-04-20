package com.idncar.api.tools;

import com.idncar.model.dto.JavaDecompileRequest;
import com.idncar.model.dto.JavaDecompileResponse;
import com.idncar.service.JavaDecompileService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tools")
public class ToolsController {

    @Autowired
    private JavaDecompileService javaDecompileService;

    @PostMapping("/java-decompile")
    public ResponseEntity<JavaDecompileResponse> javaDecompile(@RequestBody JavaDecompileRequest request) {
        return ResponseEntity.ok(javaDecompileService.decompile(request));
    }
}

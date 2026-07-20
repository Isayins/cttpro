package com.idncar.service;

import com.idncar.exception.ApiException;
import com.idncar.model.dto.JavaDecompileRequest;
import com.idncar.model.dto.JavaDecompileResponse;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JavaDecompileServiceTest {

    private final JavaDecompileService service = new JavaDecompileService();

    @Test
    void displaysBytecodeForValidClassFile() throws IOException {
        byte[] classBytes;
        try (var input = getClass().getResourceAsStream("JavaDecompileServiceTest.class")) {
            assertThat(input).isNotNull();
            classBytes = input.readAllBytes();
        }

        JavaDecompileRequest request = request("JavaDecompileServiceTest.class", classBytes);
        JavaDecompileResponse response = service.decompile(request);

        assertThat(response.getEngine()).startsWith("javap");
        assertThat(response.getOutput()).contains("JavaDecompileServiceTest");
    }

    @Test
    void rejectsFilesLargerThanTwoMegabytes() {
        JavaDecompileRequest request = request("Large.class", new byte[2 * 1024 * 1024 + 3]);

        assertThatThrownBy(() -> service.decompile(request))
                .isInstanceOf(ApiException.class)
                .hasMessage("Class 文件不能超过 2 MB");
    }

    @Test
    void rejectsNonClassContent() {
        JavaDecompileRequest request = request("Fake.class", "not a class".getBytes());

        assertThatThrownBy(() -> service.decompile(request))
                .isInstanceOf(ApiException.class)
                .hasMessage("请上传有效的 .class 文件");
    }

    private JavaDecompileRequest request(String fileName, byte[] content) {
        JavaDecompileRequest request = new JavaDecompileRequest();
        request.setFileName(fileName);
        request.setBase64Content(Base64.getEncoder().encodeToString(content));
        return request;
    }
}

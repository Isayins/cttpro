package com.idncar.service;

import com.idncar.exception.ApiException;
import com.idncar.model.dto.JavaDecompileRequest;
import com.idncar.model.dto.JavaDecompileResponse;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;

@Service
public class JavaDecompileService {

    private static final byte[] CLASS_MAGIC = new byte[]{
            (byte) 0xCA, (byte) 0xFE, (byte) 0xBA, (byte) 0xBE
    };

    public JavaDecompileResponse decompile(JavaDecompileRequest request) {
        String base64Content = requireText(request.getBase64Content(), "请上传 Class 文件或输入字节码内容");
        String fileName = normalizeFileName(request.getFileName());
        byte[] classBytes = decodeClassBytes(base64Content);

        if (!isClassFile(classBytes)) {
            throw ApiException.badRequest("请上传有效的 .class 文件");
        }

        Path tempDirectory = null;
        try {
            tempDirectory = Files.createTempDirectory("javadecompile-");
            Path classFile = tempDirectory.resolve(fileName);
            Files.write(classFile, classBytes, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

            List<String> command = buildJavapCommand(classFile);
            Process process = new ProcessBuilder(command)
                    .redirectErrorStream(true)
                    .start();

            boolean completed = process.waitFor(Duration.ofSeconds(15).toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
            if (!completed) {
                process.destroyForcibly();
                throw ApiException.badRequest("反编译超时，请检查上传的 Class 文件是否过大或已损坏");
            }

            String output = readAll(process.getInputStream()).trim();
            if (process.exitValue() != 0 || output.isEmpty()) {
                throw ApiException.badRequest(output.isEmpty() ? "反编译失败，请确认当前环境可用 javap" : output);
            }

            return new JavaDecompileResponse(
                    fileName,
                    output,
                    "javap -p -c -l -constants -s"
            );
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw ApiException.badRequest("反编译过程被中断");
        } catch (IOException e) {
            throw ApiException.badRequest("执行 javap 失败：" + e.getMessage());
        } finally {
            deleteQuietly(tempDirectory);
        }
    }

    private List<String> buildJavapCommand(Path classFile) {
        List<String> command = new ArrayList<>();
        command.add(resolveJavapExecutable());
        command.add("-p");
        command.add("-c");
        command.add("-l");
        command.add("-constants");
        command.add("-s");
        command.add(classFile.toAbsolutePath().toString());
        return command;
    }

    private String resolveJavapExecutable() {
        String executableName = isWindows() ? "javap.exe" : "javap";
        Path javaHome = Path.of(System.getProperty("java.home"));
        List<Path> candidates = List.of(
                javaHome.resolve("bin").resolve(executableName),
                javaHome.getParent() == null ? javaHome.resolve("bin").resolve(executableName) : javaHome.getParent().resolve("bin").resolve(executableName)
        );

        for (Path candidate : candidates) {
            if (Files.exists(candidate)) {
                return candidate.toAbsolutePath().toString();
            }
        }

        throw ApiException.notFound("当前运行环境未找到 javap，请使用 JDK 启动后端服务");
    }

    private byte[] decodeClassBytes(String base64Content) {
        String normalized = base64Content.trim();
        int commaIndex = normalized.indexOf(',');
        if (commaIndex >= 0 && normalized.substring(0, commaIndex).contains("base64")) {
            normalized = normalized.substring(commaIndex + 1);
        }

        try {
            return Base64.getDecoder().decode(normalized);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Base64 内容无效，请检查输入后重试");
        }
    }

    private boolean isClassFile(byte[] classBytes) {
        if (classBytes.length < CLASS_MAGIC.length) {
            return false;
        }
        for (int i = 0; i < CLASS_MAGIC.length; i++) {
            if (classBytes[i] != CLASS_MAGIC[i]) {
                return false;
            }
        }
        return true;
    }

    private String normalizeFileName(String fileName) {
        String sanitized = fileName == null || fileName.isBlank() ? "Uploaded.class" : fileName.trim();
        sanitized = sanitized.replace("\\", "_").replace("/", "_");
        return sanitized.endsWith(".class") ? sanitized : sanitized + ".class";
    }

    private String requireText(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw ApiException.badRequest(message);
        }
        return value.trim();
    }

    private String readAll(InputStream inputStream) throws IOException {
        try (InputStream in = inputStream; ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            in.transferTo(outputStream);
            return outputStream.toString(StandardCharsets.UTF_8);
        }
    }

    private void deleteQuietly(Path tempDirectory) {
        if (tempDirectory == null || !Files.exists(tempDirectory)) {
            return;
        }
        try (var stream = Files.walk(tempDirectory)) {
            stream.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                }
            });
        } catch (IOException ignored) {
        }
    }

    private boolean isWindows() {
        return System.getProperty("os.name", "").toLowerCase().contains("win");
    }
}

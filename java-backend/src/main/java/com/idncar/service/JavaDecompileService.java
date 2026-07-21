package com.idncar.service;

import com.idncar.exception.ApiException;
import com.idncar.model.dto.JavaDecompileRequest;
import com.idncar.model.dto.JavaDecompileResponse;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

@Service
public class JavaDecompileService {

    private static final int MAX_CLASS_BYTES = 2 * 1024 * 1024;
    private static final int MAX_BASE64_CHARS = 4 * ((MAX_CLASS_BYTES + 2) / 3);
    private static final long MAX_OUTPUT_BYTES = 4L * 1024 * 1024;
    private static final Duration PROCESS_TIMEOUT = Duration.ofSeconds(15);
    private static final byte[] CLASS_MAGIC = new byte[]{
            (byte) 0xCA, (byte) 0xFE, (byte) 0xBA, (byte) 0xBE
    };
    private final Semaphore processSlots = new Semaphore(2);

    public JavaDecompileResponse decompile(JavaDecompileRequest request) {
        String base64Content = requireText(request == null ? null : request.getBase64Content(), "请上传 Class 文件或输入字节码内容");
        String fileName = normalizeFileName(request == null ? null : request.getFileName());
        byte[] classBytes = decodeClassBytes(base64Content);

        if (!isClassFile(classBytes)) {
            throw ApiException.badRequest("请上传有效的 .class 文件");
        }
        if (!processSlots.tryAcquire()) {
            throw ApiException.badRequest("字节码查看任务繁忙，请稍后重试");
        }

        Path tempDirectory = null;
        try {
            tempDirectory = Files.createTempDirectory("javap-");
            Path classFile = tempDirectory.resolve(fileName);
            Path outputFile = tempDirectory.resolve("javap-output.txt");
            Files.write(classFile, classBytes, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

            List<String> command = buildJavapCommand(classFile);
            Process process = new ProcessBuilder(command)
                    .redirectErrorStream(true)
                    .redirectOutput(outputFile.toFile())
                    .start();

            waitForProcess(process, outputFile);
            String output = new String(Files.readAllBytes(outputFile), Charset.defaultCharset()).trim();
            if (process.exitValue() != 0 || output.isEmpty()) {
                throw ApiException.badRequest(output.isEmpty() ? "字节码查看失败，请确认当前环境可用 javap" : output);
            }

            return new JavaDecompileResponse(
                    fileName,
                    output,
                    "javap -p -c -l -constants -s"
            );
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw ApiException.badRequest("字节码查看过程被中断");
        } catch (IOException e) {
            throw ApiException.badRequest("执行 javap 失败：" + e.getMessage());
        } finally {
            deleteQuietly(tempDirectory);
            processSlots.release();
        }
    }

    private void waitForProcess(Process process, Path outputFile) throws IOException, InterruptedException {
        long deadline = System.nanoTime() + PROCESS_TIMEOUT.toNanos();
        while (!process.waitFor(100, TimeUnit.MILLISECONDS)) {
            if (Files.size(outputFile) > MAX_OUTPUT_BYTES) {
                stopProcess(process);
                throw ApiException.badRequest("字节码输出超过 4 MB，请使用本地 javap 处理");
            }
            if (System.nanoTime() >= deadline) {
                stopProcess(process);
                throw ApiException.badRequest("字节码查看超时，请检查 Class 文件是否已损坏");
            }
        }

        if (Files.size(outputFile) > MAX_OUTPUT_BYTES) {
            throw ApiException.badRequest("字节码输出超过 4 MB，请使用本地 javap 处理");
        }
    }

    private void stopProcess(Process process) throws InterruptedException {
        process.destroyForcibly();
        process.waitFor(1, TimeUnit.SECONDS);
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
        if (normalized.length() > MAX_BASE64_CHARS) {
            throw ApiException.badRequest("Class 文件不能超过 2 MB");
        }

        try {
            byte[] result = Base64.getDecoder().decode(normalized);
            if (result.length > MAX_CLASS_BYTES) {
                throw ApiException.badRequest("Class 文件不能超过 2 MB");
            }
            return result;
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
        sanitized = sanitized.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (sanitized.length() > 120) {
            sanitized = sanitized.substring(0, 120);
        }
        return sanitized.endsWith(".class") ? sanitized : sanitized + ".class";
    }

    private String requireText(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw ApiException.badRequest(message);
        }
        return value.trim();
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

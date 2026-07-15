package com.idncar.util;

import com.idncar.exception.ApiException;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class RichContentValidator {

    private static final Pattern IMAGE_MARKUP_PATTERN = Pattern.compile("^!\\[图片]\\(([^)]+)\\)$");

    private RichContentValidator() {
    }

    public static String requireSafeImageMarkupUrls(String content) {
        if (content == null || content.isBlank()) {
            return content;
        }

        String[] lines = content.split("\\R", -1);
        for (String line : lines) {
            Matcher matcher = IMAGE_MARKUP_PATTERN.matcher(line.trim());
            if (matcher.matches() && !isSafeImageUrl(matcher.group(1))) {
                throw ApiException.badRequest("图片地址不安全，请重新上传图片");
            }
        }
        return content;
    }

    private static boolean isSafeImageUrl(String url) {
        String trimmed = url == null ? "" : url.trim();
        if (trimmed.isEmpty() || hasControlCharacter(trimmed)) {
            return false;
        }

        if (trimmed.startsWith("//") || isSafeLocalUploadPath(trimmed)) {
            return true;
        }

        try {
            String scheme = new URI(trimmed).getScheme();
            if (scheme == null) {
                return false;
            }
            String normalizedScheme = scheme.toLowerCase(Locale.ROOT);
            return "http".equals(normalizedScheme) || "https".equals(normalizedScheme);
        } catch (URISyntaxException e) {
            return false;
        }
    }

    private static boolean isSafeLocalUploadPath(String path) {
        String normalizedPath = path.startsWith("/") ? path : "/" + path;
        return (normalizedPath.startsWith("/uploads/") || normalizedPath.startsWith("/api/uploads/"))
                && !hasUnsafeLocalPathSegment(normalizedPath);
    }

    private static boolean hasUnsafeLocalPathSegment(String path) {
        String pathPart = path.split("[?#]", 2)[0];
        if (pathPart.contains("\\")) {
            return true;
        }
        if (hasParentSegment(pathPart)) {
            return true;
        }
        try {
            return hasParentSegment(URLDecoder.decode(pathPart, StandardCharsets.UTF_8));
        } catch (IllegalArgumentException e) {
            return true;
        }
    }

    private static boolean hasParentSegment(String path) {
        for (String segment : path.split("/")) {
            if ("..".equals(segment)) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasControlCharacter(String value) {
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (character < 32 || character == 127) {
                return true;
            }
        }
        return false;
    }
}

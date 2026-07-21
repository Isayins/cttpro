package com.idncar.service;

import com.idncar.exception.ApiException;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Locale;

public final class UserProfilePolicy {

    public static final int NICKNAME_MAX_LENGTH = 50;
    public static final int AVATAR_URL_MAX_LENGTH = 255;
    public static final int BIO_MAX_LENGTH = 500;

    private static final List<String> IMAGE_PATH_PREFIXES = List.of(
            "/uploads/", "/api/uploads/", "/images/",
            "uploads/", "api/uploads/", "images/"
    );

    private UserProfilePolicy() {
    }

    public static String normalizeNickname(String value) {
        String nickname = normalizeNullableText(value);
        if (nickname == null) {
            throw ApiException.badRequest("昵称不能为空");
        }
        if (nickname.length() > NICKNAME_MAX_LENGTH) {
            throw ApiException.badRequest("昵称不能超过 " + NICKNAME_MAX_LENGTH + " 个字符");
        }
        return nickname;
    }

    public static String normalizeAvatarUrl(String value) {
        String avatarUrl = normalizeNullableText(value);
        if (avatarUrl == null) {
            return null;
        }
        if (avatarUrl.length() > AVATAR_URL_MAX_LENGTH) {
            throw ApiException.badRequest("头像地址不能超过 " + AVATAR_URL_MAX_LENGTH + " 个字符");
        }
        if (!isAllowedImageResourceUrl(avatarUrl)) {
            throw ApiException.badRequest("头像地址仅支持 HTTP(S) 或站内图片路径");
        }
        return avatarUrl;
    }

    public static String normalizeManagedAvatarUrl(String value) {
        String avatarUrl = normalizeNullableText(value);
        if (avatarUrl == null) {
            return null;
        }
        if (avatarUrl.length() > AVATAR_URL_MAX_LENGTH) {
            throw ApiException.badRequest("头像地址不能超过 " + AVATAR_URL_MAX_LENGTH + " 个字符");
        }
        if (!isAllowedSiteImagePath(avatarUrl)) {
            throw ApiException.badRequest("个人头像仅支持站内图片路径，请使用头像上传功能");
        }
        return avatarUrl;
    }

    public static String normalizeBio(String value) {
        String bio = normalizeNullableText(value);
        if (bio != null && bio.length() > BIO_MAX_LENGTH) {
            throw ApiException.badRequest("个人简介不能超过 " + BIO_MAX_LENGTH + " 个字符");
        }
        return bio;
    }

    private static boolean isAllowedImageResourceUrl(String value) {
        if (hasControlCharacter(value)) {
            return false;
        }
        if (value.startsWith("//")) {
            return hasValidRemoteHost("https:" + value);
        }

        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme();
            if (scheme != null) {
                String normalizedScheme = scheme.toLowerCase(Locale.ROOT);
                return ("http".equals(normalizedScheme) || "https".equals(normalizedScheme))
                        && uri.getHost() != null
                        && !uri.getHost().isBlank();
            }
        } catch (URISyntaxException exception) {
            return false;
        }

        return isAllowedSiteImagePath(value);
    }

    private static boolean isAllowedSiteImagePath(String value) {
        return !hasControlCharacter(value)
                && IMAGE_PATH_PREFIXES.stream().anyMatch(value::startsWith)
                && !value.contains("\\")
                && !hasParentPathSegment(value);
    }

    private static boolean hasValidRemoteHost(String value) {
        try {
            URI uri = new URI(value);
            return uri.getHost() != null && !uri.getHost().isBlank();
        } catch (URISyntaxException exception) {
            return false;
        }
    }

    private static boolean hasParentPathSegment(String value) {
        String path = value.split("[?#]", 2)[0];
        return List.of(path.split("/", -1)).contains("..");
    }

    private static boolean hasControlCharacter(String value) {
        return value.chars().anyMatch(character -> character < 32 || character == 127);
    }

    private static String normalizeNullableText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}

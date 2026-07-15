package com.idncar.vmqlistener;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.TextUtils;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public final class ConfigStore {
    private static final String PREFS = "vmq_listener";
    private static final String KEY_BASE_URL = "base_url";
    private static final String KEY_COMMUNICATION_KEY = "communication_key";
    private static final String KEY_ALIPAY_ENABLED = "alipay_enabled";
    private static final String KEY_WECHAT_ENABLED = "wechat_enabled";
    private static final String KEY_HEARTBEAT_ENABLED = "heartbeat_enabled";
    private static final String KEY_RECENT_DIGESTS = "recent_digests";
    private static final String KEY_LAST_NOTIFICATION = "last_notification";
    private static final String KEY_LAST_PARSE = "last_parse";
    private static final String KEY_LAST_PUSH = "last_push";
    private static final String KEY_LAST_ERROR = "last_error";
    private static final long DUPLICATE_WINDOW_MS = 10 * 60 * 1000L;

    private ConfigStore() {
    }

    public static String getBaseUrl(Context context) {
        return prefs(context).getString(KEY_BASE_URL, "");
    }

    public static String getCommunicationKey(Context context) {
        return prefs(context).getString(KEY_COMMUNICATION_KEY, "");
    }

    public static boolean isAlipayEnabled(Context context) {
        return prefs(context).getBoolean(KEY_ALIPAY_ENABLED, true);
    }

    public static boolean isWechatEnabled(Context context) {
        return prefs(context).getBoolean(KEY_WECHAT_ENABLED, true);
    }

    public static boolean isHeartbeatEnabled(Context context) {
        return prefs(context).getBoolean(KEY_HEARTBEAT_ENABLED, false);
    }

    public static void setHeartbeatEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_HEARTBEAT_ENABLED, enabled).apply();
    }

    public static void save(Context context,
                            String baseUrl,
                            String communicationKey,
                            boolean alipayEnabled,
                            boolean wechatEnabled) {
        prefs(context).edit()
                .putString(KEY_BASE_URL, normalizeBaseUrl(baseUrl))
                .putString(KEY_COMMUNICATION_KEY, trimToEmpty(communicationKey))
                .putBoolean(KEY_ALIPAY_ENABLED, alipayEnabled)
                .putBoolean(KEY_WECHAT_ENABLED, wechatEnabled)
                .apply();
    }

    public static boolean hasRequiredConfig(Context context) {
        return !TextUtils.isEmpty(getBaseUrl(context))
                && !TextUtils.isEmpty(getCommunicationKey(context));
    }

    public static String endpoint(Context context, String path) {
        String baseUrl = getBaseUrl(context);
        if (TextUtils.isEmpty(baseUrl)) {
            return "";
        }
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        return baseUrl + path;
    }

    public static void recordNotification(Context context, String packageName, String content) {
        prefs(context).edit()
                .putString(KEY_LAST_NOTIFICATION, timestamp() + " " + safe(packageName) + "\n" + safe(content))
                .apply();
    }

    public static void recordParse(Context context, String message) {
        prefs(context).edit()
                .putString(KEY_LAST_PARSE, timestamp() + " " + safe(message))
                .apply();
    }

    public static void recordPush(Context context, String message) {
        prefs(context).edit()
                .putString(KEY_LAST_PUSH, timestamp() + " " + safe(message))
                .remove(KEY_LAST_ERROR)
                .apply();
    }

    public static void recordError(Context context, String message) {
        prefs(context).edit()
                .putString(KEY_LAST_ERROR, timestamp() + " " + safe(message))
                .apply();
    }

    public static String diagnostics(Context context) {
        SharedPreferences preferences = prefs(context);
        StringBuilder builder = new StringBuilder();
        appendDiagnostic(builder, "最近通知", preferences.getString(KEY_LAST_NOTIFICATION, "-"));
        appendDiagnostic(builder, "解析结果", preferences.getString(KEY_LAST_PARSE, "-"));
        appendDiagnostic(builder, "推送结果", preferences.getString(KEY_LAST_PUSH, "-"));
        appendDiagnostic(builder, "最近错误", preferences.getString(KEY_LAST_ERROR, "-"));
        return builder.toString();
    }

    public static void clearDiagnostics(Context context) {
        prefs(context).edit()
                .remove(KEY_LAST_NOTIFICATION)
                .remove(KEY_LAST_PARSE)
                .remove(KEY_LAST_PUSH)
                .remove(KEY_LAST_ERROR)
                .remove(KEY_RECENT_DIGESTS)
                .apply();
    }

    public static synchronized boolean rememberNotificationDigest(Context context, String digest) {
        if (TextUtils.isEmpty(digest)) {
            return false;
        }
        long now = System.currentTimeMillis();
        SharedPreferences preferences = prefs(context);
        String current = preferences.getString(KEY_RECENT_DIGESTS, "");
        String[] lines = current == null ? new String[0] : current.split("\\n");
        List<String> nextLines = new ArrayList<>();
        boolean duplicate = false;

        for (String line : lines) {
            String[] parts = line.split("\\|", 2);
            if (parts.length != 2) {
                continue;
            }
            long timestamp;
            try {
                timestamp = Long.parseLong(parts[0]);
            } catch (NumberFormatException ignored) {
                continue;
            }
            if (now - timestamp > DUPLICATE_WINDOW_MS) {
                continue;
            }
            if (digest.equals(parts[1])) {
                duplicate = true;
            }
            nextLines.add(timestamp + "|" + parts[1]);
        }

        if (duplicate) {
            preferences.edit().putString(KEY_RECENT_DIGESTS, joinLines(nextLines)).apply();
            return false;
        }

        nextLines.add(0, now + "|" + digest);
        while (nextLines.size() > 20) {
            nextLines.remove(nextLines.size() - 1);
        }
        preferences.edit().putString(KEY_RECENT_DIGESTS, joinLines(nextLines)).apply();
        return true;
    }

    public static String normalizeBaseUrl(String raw) {
        String value = trimToEmpty(raw);
        if (value.endsWith("/getState")) {
            value = value.substring(0, value.length() - "/getState".length());
        } else if (value.endsWith("/appHeart")) {
            value = value.substring(0, value.length() - "/appHeart".length());
        } else if (value.endsWith("/appPush")) {
            value = value.substring(0, value.length() - "/appPush".length());
        }
        while (value.endsWith("/")) {
            value = value.substring(0, value.length() - 1);
        }
        return value;
    }

    private static String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private static String safe(String value) {
        return value == null || value.trim().isEmpty() ? "-" : value.trim();
    }

    private static void appendDiagnostic(StringBuilder builder, String label, String value) {
        if (builder.length() > 0) {
            builder.append("\n\n");
        }
        builder.append(label).append("：").append(safe(value));
    }

    private static String timestamp() {
        return new SimpleDateFormat("MM-dd HH:mm:ss", Locale.CHINA).format(new Date());
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static String joinLines(List<String> lines) {
        StringBuilder builder = new StringBuilder();
        for (String line : lines) {
            if (builder.length() > 0) {
                builder.append('\n');
            }
            builder.append(line);
        }
        return builder.toString();
    }
}

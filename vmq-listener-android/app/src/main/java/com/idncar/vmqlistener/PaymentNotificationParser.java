package com.idncar.vmqlistener;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class PaymentNotificationParser {
    public static final int TYPE_WECHAT = 1;
    public static final int TYPE_ALIPAY = 2;

    private static final String ALIPAY_PACKAGE = "com.eg.android.AlipayGphone";
    private static final String WECHAT_PACKAGE = "com.tencent.mm";
    private static final Pattern[] AMOUNT_PATTERNS = new Pattern[]{
            Pattern.compile("(?:收款|到账|入账|收到一笔|收钱|向你付款|向您付款|已收钱|付款给你|付款给您).*?(?:人民币|RMB|CNY|￥|¥)?\\s*([0-9]+(?:\\.[0-9]{1,2})?)\\s*元?"),
            Pattern.compile("(?:人民币|RMB|CNY|￥|¥)\\s*([0-9]+(?:\\.[0-9]{1,2})?)"),
            Pattern.compile("([0-9]+(?:\\.[0-9]{1,2})?)\\s*元")
    };

    private PaymentNotificationParser() {
    }

    public static ParsedPayment parse(String packageName, String title, String text, String bigText) {
        int type = resolvePayType(packageName);
        if (type == 0) {
            return null;
        }

        String content = content(title, text, bigText);
        if (!looksLikeIncomingPayment(content)) {
            return null;
        }

        String price = extractAmount(content);
        if (price == null) {
            return null;
        }

        return new ParsedPayment(type, price, content);
    }

    public static int resolvePayType(String packageName) {
        if (packageName == null) {
            return 0;
        }
        if (ALIPAY_PACKAGE.equals(packageName)) {
            return TYPE_ALIPAY;
        }
        if (WECHAT_PACKAGE.equals(packageName)) {
            return TYPE_WECHAT;
        }
        return 0;
    }

    private static boolean looksLikeIncomingPayment(String content) {
        if (content.isEmpty()) {
            return false;
        }
        String lower = content.toLowerCase(Locale.ROOT);
        if (lower.contains("退款")
                || lower.contains("退回")
                || lower.contains("付款成功")
                || lower.contains("已付款")
                || lower.contains("支出")
                || lower.contains("扣款")
                || lower.contains("消费")) {
            return false;
        }
        return lower.contains("收款")
                || lower.contains("到账")
                || lower.contains("入账")
                || lower.contains("收到一笔")
                || lower.contains("收钱")
                || lower.contains("向你付款")
                || lower.contains("向您付款")
                || lower.contains("付款给你")
                || lower.contains("付款给您")
                || lower.contains("已收钱");
    }

    public static String content(String title, String text, String bigText) {
        return normalize(join(title, text, bigText));
    }

    private static String extractAmount(String content) {
        for (Pattern pattern : AMOUNT_PATTERNS) {
            Matcher matcher = pattern.matcher(content);
            if (!matcher.find()) {
                continue;
            }
            try {
                BigDecimal amount = new BigDecimal(matcher.group(1));
                if (amount.compareTo(BigDecimal.ZERO) <= 0) {
                    continue;
                }
                return amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
            } catch (NumberFormatException ignored) {
                // Try the next pattern.
            }
        }
        return null;
    }

    private static String join(String title, String text, String bigText) {
        StringBuilder builder = new StringBuilder();
        append(builder, title);
        append(builder, text);
        append(builder, bigText);
        return builder.toString();
    }

    private static void append(StringBuilder builder, String value) {
        if (value == null || value.trim().isEmpty()) {
            return;
        }
        if (builder.length() > 0) {
            builder.append(' ');
        }
        builder.append(value.trim());
    }

    private static String normalize(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace('\n', ' ')
                .replace('\r', ' ')
                .replace("　", " ")
                .trim();
    }

    public static final class ParsedPayment {
        public final int type;
        public final String price;
        public final String content;

        ParsedPayment(int type, String price, String content) {
            this.type = type;
            this.price = price;
            this.content = content;
        }
    }
}

package com.idncar.vmqlistener;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class VmqNotificationListenerService extends NotificationListenerService {
    private static final String TAG = "VmqNotificationListener";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) {
            return;
        }
        Notification notification = sbn.getNotification();
        Bundle extras = notification.extras;
        String title = asString(extras.getCharSequence(Notification.EXTRA_TITLE));
        String text = asString(extras.getCharSequence(Notification.EXTRA_TEXT));
        String bigText = asString(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));
        if (bigText.isEmpty()) {
            bigText = asString(extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT));
        }
        String content = PaymentNotificationParser.content(title, text, bigText);
        int payType = PaymentNotificationParser.resolvePayType(sbn.getPackageName());
        if (payType != 0) {
            ConfigStore.recordNotification(this, sbn.getPackageName(), content);
        }

        PaymentNotificationParser.ParsedPayment parsed = PaymentNotificationParser.parse(
                sbn.getPackageName(),
                title,
                text,
                bigText
        );
        if (parsed == null) {
            if (payType != 0) {
                ConfigStore.recordParse(this, "未识别为收款通知：" + content);
            }
            return;
        }
        if (!isTypeEnabled(parsed.type)) {
            ConfigStore.recordParse(this, "已识别但该渠道未勾选：type=" + parsed.type + ", price=" + parsed.price);
            return;
        }

        String digest = digest(sbn.getKey() + "|" + sbn.getPostTime() + "|" + parsed.type + "|" + parsed.price + "|" + parsed.content);
        if (!ConfigStore.rememberNotificationDigest(this, digest)) {
            Log.i(TAG, "Duplicate payment notification skipped: " + parsed.price);
            ConfigStore.recordParse(this, "重复通知已跳过：type=" + parsed.type + ", price=" + parsed.price);
            return;
        }
        ConfigStore.recordParse(this, "识别成功：type=" + parsed.type + ", price=" + parsed.price);

        executor.execute(() -> {
            try {
                VmqApiClient.Response response = VmqApiClient.pushPayment(
                        this,
                        parsed.type,
                        parsed.price,
                        sbn.getPostTime(),
                        digest,
                        false
                );
                ConfigStore.recordPush(this, "自动推送 type=" + parsed.type
                        + ", price=" + parsed.price
                        + ", response=" + response.code
                        + " " + response.body);
                Log.i(TAG, "Payment pushed: type=" + parsed.type
                        + ", price=" + parsed.price
                        + ", response=" + response.code
                        + " " + response.body);
            } catch (Exception ex) {
                ConfigStore.recordError(this, "自动推送失败 type=" + parsed.type
                        + ", price=" + parsed.price
                        + "：" + ex.getMessage());
                Log.w(TAG, "Payment push failed: type=" + parsed.type + ", price=" + parsed.price, ex);
            }
        });
    }

    @Override
    public void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }

    private boolean isTypeEnabled(int type) {
        if (type == PaymentNotificationParser.TYPE_ALIPAY) {
            return ConfigStore.isAlipayEnabled(this);
        }
        if (type == PaymentNotificationParser.TYPE_WECHAT) {
            return ConfigStore.isWechatEnabled(this);
        }
        return false;
    }

    private static String asString(CharSequence value) {
        return value == null ? "" : value.toString();
    }

    private static String digest(String value) {
        try {
            MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = messageDigest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(bytes.length * 2);
            for (byte item : bytes) {
                builder.append(String.format("%02x", item & 0xff));
            }
            return builder.toString();
        } catch (Exception ex) {
            return String.valueOf(value.hashCode());
        }
    }
}

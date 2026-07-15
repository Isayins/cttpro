package com.idncar.vmqlistener;

import android.Manifest;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Space;
import android.widget.TextView;
import android.widget.Toast;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends android.app.Activity {
    private EditText baseUrlInput;
    private EditText keyInput;
    private EditText manualAmountInput;
    private CheckBox alipayBox;
    private CheckBox wechatBox;
    private TextView statusView;
    private TextView diagnosticsView;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(buildContentView());
        loadConfig();
        refreshStatus();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshStatus();
    }

    @Override
    protected void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }

    private View buildContentView() {
        int padding = dp(20);
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(true);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(padding, padding, padding, padding);
        scrollView.addView(root, new ScrollView.LayoutParams(
                ScrollView.LayoutParams.MATCH_PARENT,
                ScrollView.LayoutParams.WRAP_CONTENT
        ));

        TextView title = new TextView(this);
        title.setText("IDN V免签监听端");
        title.setTextSize(24);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        root.addView(title);

        statusView = new TextView(this);
        statusView.setTextSize(14);
        statusView.setPadding(0, dp(10), 0, dp(10));
        root.addView(statusView);

        root.addView(label("服务地址"));
        baseUrlInput = new EditText(this);
        baseUrlInput.setSingleLine(true);
        baseUrlInput.setHint("https://idncar.com");
        baseUrlInput.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        root.addView(baseUrlInput, matchWidth());

        root.addView(label("通讯密钥"));
        keyInput = new EditText(this);
        keyInput.setSingleLine(true);
        keyInput.setHint("后台 V免签配置里的通讯密钥");
        keyInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        root.addView(keyInput, matchWidth());

        alipayBox = new CheckBox(this);
        alipayBox.setText("监听支付宝");
        root.addView(alipayBox);

        wechatBox = new CheckBox(this);
        wechatBox.setText("监听微信");
        root.addView(wechatBox);

        Button saveButton = button("保存配置");
        saveButton.setOnClickListener(v -> saveConfig());
        root.addView(saveButton, matchWidthWithTopMargin(12));

        Button notificationAccessButton = button("打开通知读取权限");
        notificationAccessButton.setOnClickListener(v -> openNotificationListenerSettings());
        root.addView(notificationAccessButton, matchWidthWithTopMargin(8));

        Button notificationPermissionButton = button("允许前台通知");
        notificationPermissionButton.setOnClickListener(v -> requestPostNotificationPermission());
        root.addView(notificationPermissionButton, matchWidthWithTopMargin(8));

        Button startButton = button("启动心跳");
        startButton.setOnClickListener(v -> startHeartbeat());
        root.addView(startButton, matchWidthWithTopMargin(8));

        Button stopButton = button("停止心跳");
        stopButton.setOnClickListener(v -> stopHeartbeat());
        root.addView(stopButton, matchWidthWithTopMargin(8));

        Button testButton = button("测试心跳");
        testButton.setOnClickListener(v -> sendTestHeartbeat());
        root.addView(testButton, matchWidthWithTopMargin(8));

        root.addView(label("手动推送测试金额"));
        manualAmountInput = new EditText(this);
        manualAmountInput.setSingleLine(true);
        manualAmountInput.setHint("例如 0.01");
        manualAmountInput.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL);
        root.addView(manualAmountInput, matchWidth());

        Button manualAlipayButton = button("手动推送支付宝收款");
        manualAlipayButton.setOnClickListener(v -> sendManualPayment(PaymentNotificationParser.TYPE_ALIPAY));
        root.addView(manualAlipayButton, matchWidthWithTopMargin(8));

        Button manualWechatButton = button("手动推送微信收款");
        manualWechatButton.setOnClickListener(v -> sendManualPayment(PaymentNotificationParser.TYPE_WECHAT));
        root.addView(manualWechatButton, matchWidthWithTopMargin(8));

        TextView diagnosticsTitle = label("诊断信息");
        root.addView(diagnosticsTitle);
        diagnosticsView = new TextView(this);
        diagnosticsView.setTextSize(13);
        diagnosticsView.setPadding(dp(12), dp(10), dp(12), dp(10));
        diagnosticsView.setBackgroundColor(0xFFF8FAFC);
        root.addView(diagnosticsView, matchWidth());

        Button refreshDiagnosticsButton = button("刷新诊断信息");
        refreshDiagnosticsButton.setOnClickListener(v -> refreshStatus());
        root.addView(refreshDiagnosticsButton, matchWidthWithTopMargin(8));

        Button clearDiagnosticsButton = button("清空诊断信息");
        clearDiagnosticsButton.setOnClickListener(v -> {
            ConfigStore.clearDiagnostics(this);
            refreshStatus();
            toast("诊断信息已清空");
        });
        root.addView(clearDiagnosticsButton, matchWidthWithTopMargin(8));

        Space bottomSpace = new Space(this);
        root.addView(bottomSpace, new LinearLayout.LayoutParams(1, dp(20)));
        return scrollView;
    }

    private void loadConfig() {
        baseUrlInput.setText(ConfigStore.getBaseUrl(this));
        keyInput.setText(ConfigStore.getCommunicationKey(this));
        alipayBox.setChecked(ConfigStore.isAlipayEnabled(this));
        wechatBox.setChecked(ConfigStore.isWechatEnabled(this));
    }

    private void saveConfig() {
        String normalizedBaseUrl = ConfigStore.normalizeBaseUrl(baseUrlInput.getText().toString());
        String key = keyInput.getText().toString().trim();
        if (TextUtils.isEmpty(normalizedBaseUrl) || TextUtils.isEmpty(key)) {
            toast("请填写服务地址和通讯密钥");
            return;
        }
        ConfigStore.save(this, normalizedBaseUrl, key, alipayBox.isChecked(), wechatBox.isChecked());
        baseUrlInput.setText(normalizedBaseUrl);
        toast("配置已保存");
        refreshStatus();
    }

    private void startHeartbeat() {
        saveConfig();
        if (!ConfigStore.hasRequiredConfig(this)) {
            return;
        }
        try {
            HeartbeatService.start(this);
            ConfigStore.setHeartbeatEnabled(this, true);
            toast("心跳已启动");
        } catch (RuntimeException ex) {
            toast("心跳启动失败：" + ex.getMessage());
        }
        refreshStatus();
    }

    private void stopHeartbeat() {
        HeartbeatService.stop(this);
        ConfigStore.setHeartbeatEnabled(this, false);
        toast("心跳已停止");
        refreshStatus();
    }

    private void sendTestHeartbeat() {
        saveConfig();
        if (!ConfigStore.hasRequiredConfig(this)) {
            return;
        }
        executor.execute(() -> {
            try {
                VmqApiClient.Response response = VmqApiClient.sendHeartbeat(this);
                runOnUiThread(() -> toast("心跳返回：" + response.code + " " + response.body));
            } catch (Exception ex) {
                runOnUiThread(() -> toast("心跳失败：" + ex.getMessage()));
            }
        });
    }

    private void sendManualPayment(int type) {
        saveConfig();
        if (!ConfigStore.hasRequiredConfig(this)) {
            return;
        }
        String amount = manualAmountInput.getText().toString().trim();
        if (TextUtils.isEmpty(amount)) {
            toast("请填写测试金额");
            return;
        }
        executor.execute(() -> {
            try {
                VmqApiClient.Response response = VmqApiClient.pushPayment(
                        this,
                        type,
                        amount,
                        System.currentTimeMillis(),
                        null,
                        true
                );
                String message = "手动推送 type=" + type + ", amount=" + amount
                        + ", response=" + response.code + " " + response.body;
                ConfigStore.recordPush(this, message);
                runOnUiThread(() -> {
                    refreshStatus();
                    toast("推送返回：" + response.code + " " + response.body);
                });
            } catch (Exception ex) {
                ConfigStore.recordError(this, "手动推送失败：" + ex.getMessage());
                runOnUiThread(() -> {
                    refreshStatus();
                    toast("推送失败：" + ex.getMessage());
                });
            }
        });
    }

    private void openNotificationListenerSettings() {
        startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
    }

    private void requestPostNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            toast("当前系统无需单独授权");
            return;
        }
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            toast("前台通知已允许");
            return;
        }
        requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 100);
    }

    private void refreshStatus() {
        StringBuilder builder = new StringBuilder();
        builder.append("通知读取：").append(isNotificationListenerEnabled() ? "已开启" : "未开启");
        builder.append("\n前台通知：").append(isPostNotificationAllowed() ? "已允许" : "未允许");
        builder.append("\n心跳开关：").append(ConfigStore.isHeartbeatEnabled(this) ? "已启动" : "未启动");
        builder.append("\n接口：").append(ConfigStore.endpoint(this, "/appPush"));
        statusView.setText(builder.toString());
        if (diagnosticsView != null) {
            diagnosticsView.setText(ConfigStore.diagnostics(this));
        }
    }

    private boolean isPostNotificationAllowed() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return true;
        }
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        return manager != null && manager.areNotificationsEnabled();
    }

    private boolean isNotificationListenerEnabled() {
        String enabledListeners = Settings.Secure.getString(
                getContentResolver(),
                "enabled_notification_listeners"
        );
        if (enabledListeners == null) {
            return false;
        }
        ComponentName componentName = new ComponentName(this, VmqNotificationListenerService.class);
        String flattened = componentName.flattenToString();
        String flattenedShort = componentName.flattenToShortString();
        return enabledListeners.contains(flattened) || enabledListeners.contains(flattenedShort);
    }

    private TextView label(String text) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(14);
        view.setTypeface(Typeface.DEFAULT_BOLD);
        view.setPadding(0, dp(14), 0, dp(4));
        return view;
    }

    private Button button(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        button.setGravity(Gravity.CENTER);
        return button;
    }

    private LinearLayout.LayoutParams matchWidth() {
        return new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
    }

    private LinearLayout.LayoutParams matchWidthWithTopMargin(int topDp) {
        LinearLayout.LayoutParams params = matchWidth();
        params.topMargin = dp(topDp);
        return params;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    public void openAppSettings() {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        intent.setData(Uri.parse("package:" + getPackageName()));
        startActivity(intent);
    }
}

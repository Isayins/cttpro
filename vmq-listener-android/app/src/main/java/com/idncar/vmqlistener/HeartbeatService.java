package com.idncar.vmqlistener;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class HeartbeatService extends Service {
    public static final String ACTION_STOP = "com.idncar.vmqlistener.STOP_HEARTBEAT";
    private static final String TAG = "HeartbeatService";
    private static final String CHANNEL_ID = "vmq_listener_heartbeat";
    private static final int NOTIFICATION_ID = 1001;
    private static final long HEARTBEAT_SECONDS = 30L;

    private ScheduledExecutorService executor;

    public static void start(Context context) {
        Intent intent = new Intent(context, HeartbeatService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void stop(Context context) {
        Intent intent = new Intent(context, HeartbeatService.class);
        intent.setAction(ACTION_STOP);
        context.startService(intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
        startHeartbeatLoop();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            ConfigStore.setHeartbeatEnabled(this, false);
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!ConfigStore.hasRequiredConfig(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        ConfigStore.setHeartbeatEnabled(this, true);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (executor != null) {
            executor.shutdownNow();
            executor = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void startHeartbeatLoop() {
        if (executor != null) {
            return;
        }
        executor = Executors.newSingleThreadScheduledExecutor();
        executor.scheduleAtFixedRate(() -> {
            if (!ConfigStore.hasRequiredConfig(this)) {
                Log.w(TAG, "Heartbeat skipped: missing base URL or key");
                return;
            }
            try {
                VmqApiClient.Response response = VmqApiClient.sendHeartbeat(this);
                Log.i(TAG, "Heartbeat response: " + response.code + " " + response.body);
            } catch (Exception ex) {
                Log.w(TAG, "Heartbeat failed", ex);
            }
        }, 0L, HEARTBEAT_SECONDS, TimeUnit.SECONDS);
    }

    private Notification buildNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        return builder
                .setContentTitle("V免签监听运行中")
                .setContentText("正在保持心跳并等待收款通知")
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setOngoing(true)
                .setContentIntent(openPendingIntent)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "V免签监听",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("V免签监听端心跳状态");
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }
}

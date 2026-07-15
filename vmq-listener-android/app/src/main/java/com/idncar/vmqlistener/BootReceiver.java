package com.idncar.vmqlistener;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) {
            return;
        }
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)) {
            return;
        }
        if (!ConfigStore.isHeartbeatEnabled(context) || !ConfigStore.hasRequiredConfig(context)) {
            return;
        }
        try {
            HeartbeatService.start(context);
        } catch (RuntimeException ex) {
            Log.w(TAG, "Unable to restart heartbeat service after boot", ex);
        }
    }
}

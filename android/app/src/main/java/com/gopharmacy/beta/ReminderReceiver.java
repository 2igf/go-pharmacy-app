package com.gopharmacy.beta;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/** Explicit app alarms plus Android protected boot/clock/timezone broadcasts. */
public class ReminderReceiver extends BroadcastReceiver {
    // At most one short-lived worker and a bounded queue, even if several inexact alarms coalesce.
    private static final ThreadPoolExecutor WORK = new ThreadPoolExecutor(0, 1, 15, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(32), runnable -> new Thread(runnable, "go-reminder-receiver"));

    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        boolean alarm = ReminderScheduler.ALARM_ACTION.equals(action);
        if (!alarm && !Intent.ACTION_BOOT_COMPLETED.equals(action) && !Intent.ACTION_TIME_CHANGED.equals(action)
                && !Intent.ACTION_TIMEZONE_CHANGED.equals(action) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) return;
        PendingResult pending = goAsync();
        Context app = context.getApplicationContext();
        try { WORK.execute(() -> {
            try {
                ReminderScheduler scheduler = new ReminderScheduler(app);
                if (alarm) scheduler.fire(intent); else scheduler.restore();
            } catch (Exception ignored) { /* Authenticated local state is required; no fallback to untrusted extras. */ }
            finally { pending.finish(); }
        }); } catch (RejectedExecutionException busy) { pending.finish(); }
    }
}
